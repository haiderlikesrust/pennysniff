import './style.css';
import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';
import { World } from './world';
import { UI } from './ui';

// Server connection
const SERVER_URL = import.meta.env.PROD
  ? 'https://api.coinsniffer.fun'
  : 'http://localhost:9113';

class PennySnifferGame {
  private socket: Socket;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private world: World;
  private ui: UI;

  private playerId: string = '';
  private walletAddress: string = '';
  private isPlaying: boolean = false;
  private isSpectating: boolean = false;

  // Player controls
  private moveForward: boolean = false;
  private moveBackward: boolean = false;
  private moveLeft: boolean = false;
  private moveRight: boolean = false;
  private canJump: boolean = true;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private direction: THREE.Vector3 = new THREE.Vector3();

  // Mouse look
  private euler: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private isPointerLocked: boolean = false;

  // Game state
  private myScore: number = 0;
  private pennies: Map<string, THREE.Mesh> = new Map();
  private otherPlayers: Map<string, THREE.Group> = new Map();
  private playerWallets: Map<string, string> = new Map();

  // Audio
  private audioContext: AudioContext | null = null;
  private coinSound: AudioBuffer | null = null;

  // Voice Chat
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private isInVoiceChat: boolean = false;
  private isMuted: boolean = false;

  constructor() {
    this.socket = io(SERVER_URL);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.world = new World(this.scene);
    this.ui = new UI();

    this.init();
  }

  private init(): void {
    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.appendChild(this.renderer.domElement);
    }

    // Initial camera position
    this.camera.position.set(0, 1.7, 0);

    // Setup lighting
    this.setupLighting();

    // Setup controls
    this.setupControls();

    // Setup socket events
    this.setupSocketEvents();

    // Setup UI events
    this.setupUIEvents();

    // Setup audio
    this.setupAudio();

    // Setup voice chat events
    this.setupVoiceChatEvents();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());

    // Start animation loop (but don't render game yet)
    this.animate();
  }

  private async setupAudio(): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      
      // Create coin collection sound programmatically
      const sampleRate = this.audioContext.sampleRate;
      const duration = 0.3;
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate a pleasant "ding" sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        // Multiple harmonics for a rich coin sound
        const freq1 = 880; // A5
        const freq2 = 1320; // E6
        const freq3 = 1760; // A6
        
        const envelope = Math.exp(-t * 10); // Quick decay
        data[i] = envelope * (
          0.5 * Math.sin(2 * Math.PI * freq1 * t) +
          0.3 * Math.sin(2 * Math.PI * freq2 * t) +
          0.2 * Math.sin(2 * Math.PI * freq3 * t)
        );
      }
      
      this.coinSound = buffer;
      console.log('🔊 Audio system initialized');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  private playCoinSound(): void {
    if (!this.audioContext || !this.coinSound) return;
    
    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = this.coinSound;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0.3; // Volume
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    source.start();
  }

  // ============ VOICE CHAT METHODS ============
  
  private setupVoiceChatEvents(): void {
    // Receive list of existing voice peers when joining
    this.socket.on('voice_peers_list', async (data: { peers: string[] }) => {
      console.log('🎤 Existing voice peers:', data.peers);
      for (const peerId of data.peers) {
        await this.createPeerConnection(peerId, true);
      }
    });

    // New peer joined voice
    this.socket.on('voice_peer_joined', async (data: { peerId: string }) => {
      console.log('🎤 New voice peer:', data.peerId);
      if (this.isInVoiceChat) {
        await this.createPeerConnection(data.peerId, false);
      }
    });

    // Peer left voice
    this.socket.on('voice_peer_left', (data: { peerId: string }) => {
      console.log('🔇 Voice peer left:', data.peerId);
      this.closePeerConnection(data.peerId);
    });

    // Receive WebRTC offer
    this.socket.on('voice_offer', async (data: { fromId: string; offer: RTCSessionDescriptionInit }) => {
      console.log('📞 Received voice offer from:', data.fromId);
      const pc = this.peerConnections.get(data.fromId) || await this.createPeerConnection(data.fromId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit('voice_answer', { targetId: data.fromId, answer });
    });

    // Receive WebRTC answer
    this.socket.on('voice_answer', async (data: { fromId: string; answer: RTCSessionDescriptionInit }) => {
      console.log('📞 Received voice answer from:', data.fromId);
      const pc = this.peerConnections.get(data.fromId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    // Receive ICE candidate
    this.socket.on('voice_ice_candidate', async (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
      const pc = this.peerConnections.get(data.fromId);
      if (pc && data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    // Peer muted/unmuted
    this.socket.on('voice_peer_muted', (data: { peerId: string; muted: boolean }) => {
      this.ui.updateVoicePeerMuted(data.peerId, data.muted);
    });
  }

  private async createPeerConnection(peerId: string, initiator: boolean): Promise<RTCPeerConnection> {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnections.set(peerId, pc);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming audio
    pc.ontrack = (event) => {
      console.log('🔊 Received audio track from:', peerId);
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      audio.id = `voice-audio-${peerId}`;
      document.body.appendChild(audio);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('voice_ice_candidate', {
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log(`Voice connection to ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.closePeerConnection(peerId);
      }
    };

    // If initiator, create and send offer
    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('voice_offer', { targetId: peerId, offer });
    }

    return pc;
  }

  private closePeerConnection(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    
    // Remove audio element
    const audioEl = document.getElementById(`voice-audio-${peerId}`);
    if (audioEl) {
      audioEl.remove();
    }
  }

  async joinVoiceChat(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.isInVoiceChat = true;
      this.socket.emit('voice_join');
      this.ui.updateVoiceStatus(true, false);
      console.log('🎤 Joined voice chat');
    } catch (error) {
      console.error('Failed to join voice chat:', error);
      this.ui.showMessage('Failed to access microphone', 'error');
    }
  }

  leaveVoiceChat(): void {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close all peer connections
    this.peerConnections.forEach((_, peerId) => {
      this.closePeerConnection(peerId);
    });

    this.isInVoiceChat = false;
    this.socket.emit('voice_leave');
    this.ui.updateVoiceStatus(false, false);
    console.log('🔇 Left voice chat');
  }

  toggleMute(): void {
    if (!this.localStream) return;
    
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });
    
    this.socket.emit('voice_mute_toggle', { muted: this.isMuted });
    this.ui.updateVoiceStatus(true, this.isMuted);
  }

  // ============ END VOICE CHAT ============

  private setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    // Directional light (sun)
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    this.scene.add(sun);

    // Hemisphere light for sky color
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x362d1f, 0.5);
    this.scene.add(hemi);

    // Sky background
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
  }

  private setupControls(): void {
    // Keyboard controls
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Mouse look - pointer lock
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.addEventListener('click', () => {
        if (this.isPlaying && !this.isPointerLocked) {
          gameContainer.requestPointerLock();
        }
      });
    }

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement !== null;
    });

    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.isPlaying) return;

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = true;
        break;
      case 'Space':
        if (this.canJump) {
          this.velocity.y = 8;
          this.canJump = false;
        }
        break;
      case 'KeyE':
        this.interactWithDoor();
        break;
    }
  }

  private interactWithDoor(): void {
    const playerPos = this.camera.position;
    const interactRadius = 3;

    for (const door of this.world.doors) {
      const doorWorldPos = new THREE.Vector3();
      door.getWorldPosition(doorWorldPos);

      const distance = playerPos.distanceTo(doorWorldPos);
      if (distance < interactRadius) {
        this.world.toggleDoor(door);
        break;
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = false;
        break;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isPointerLocked || !this.isPlaying) return;

    const sensitivity = 0.002;
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= e.movementX * sensitivity;
    this.euler.x -= e.movementY * sensitivity;
    this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  private setupSocketEvents(): void {
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('lobby_joined', (data: any) => {
      if (data.success) {
        this.playerId = data.playerId;
        this.ui.showMessage('Joined lobby! Waiting for game...', 'success');
        this.ui.updateLobby(data.lobbyState);
      } else {
        this.ui.showMessage(data.reason, 'error');
      }
    });

    this.socket.on('lobby_update', (lobbyState: any) => {
      this.ui.updateLobby(lobbyState);
    });

    this.socket.on('lobby_timer', (data: any) => {
      this.ui.updateLobbyTimer(data.remaining);
    });

    this.socket.on('lobby_message', (data: any) => {
      this.ui.showMessage(data.message, 'info');
    });

    this.socket.on('spectator_joined', (data: any) => {
      this.isSpectating = true;
      this.startGame(data.gameState);
    });

    this.socket.on('game_start', (data: any) => {
      this.startGame(data);
    });

    this.socket.on('game_timer', (data: any) => {
      this.ui.updateGameTimer(data.remaining);
    });

    this.socket.on('player_moved', (data: any) => {
      this.updateOtherPlayer(data.playerId, data.position, data.rotation);
    });

    this.socket.on('penny_collected', (data: any) => {
      this.removePenny(data.pennyId);
      if (data.playerId === this.playerId) {
        this.myScore = data.playerScore;
        this.ui.updateScore(this.myScore);
        // Play coin collection sound
        this.playCoinSound();
      }
    });

    this.socket.on('scores_update', (scores: any[]) => {
      this.ui.updateLeaderboard(scores);
    });

    this.socket.on('player_left', (data: any) => {
      this.removeOtherPlayer(data.playerId);
    });

    this.socket.on('game_end', (data: any) => {
      this.endGame(data);
      // Leave voice chat when game ends
      if (this.isInVoiceChat) {
        this.leaveVoiceChat();
      }
    });

    this.socket.on('game_reset', (data: any) => {
      this.resetGame(data);
    });

    this.socket.on('rewards_distributed', (_data: any) => {
      this.ui.showMessage('🎉 Rewards distributed!', 'success');
    });
  }

  private setupUIEvents(): void {
    const joinBtn = document.getElementById('join-btn');
    const spectateBtn = document.getElementById('spectate-btn');
    const walletInput = document.getElementById('wallet-input') as HTMLInputElement;
    const playAgainBtn = document.getElementById('play-again-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const muteBtn = document.getElementById('mute-btn');

    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        const wallet = walletInput?.value.trim();
        if (wallet && wallet.length >= 32) {
          this.walletAddress = wallet;
          this.socket.emit('join_lobby', { walletAddress: wallet });
        } else {
          this.ui.showMessage('Please enter a valid Solana wallet address', 'error');
        }
      });
    }

    if (spectateBtn) {
      spectateBtn.addEventListener('click', () => {
        this.socket.emit('join_spectator');
      });
    }

    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        this.ui.showScreen('lobby');
      });
    }

    // Voice chat buttons
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        if (this.isInVoiceChat) {
          this.leaveVoiceChat();
        } else {
          this.joinVoiceChat();
        }
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.toggleMute();
      });
    }
  }

  private startGame(data: any): void {
    this.isPlaying = true;
    this.myScore = 0;

    // Show game screen
    this.ui.showScreen('game');
    this.ui.updateScore(0);

    // Build the world
    this.world.build();

    // Spawn pennies
    if (data.pennies) {
      for (const penny of data.pennies) {
        this.spawnPenny(penny.id, penny.position);
      }
    }

    // Set player starting position
    const myPlayer = data.players?.find((p: any) => p.id === this.playerId);
    if (myPlayer) {
      this.camera.position.set(myPlayer.position.x, myPlayer.position.y, myPlayer.position.z);
    }

    // Spawn other players
    if (data.players) {
      for (const player of data.players) {
        if (player.id !== this.playerId) {
          this.spawnOtherPlayer(player.id, player.position, player.walletAddress);
        }
      }
    }

    // Update pennies remaining
    this.ui.updatePenniesLeft(data.pennies?.length || 0);
  }

  private spawnPenny(id: string, position: { x: number; y: number; z: number }): void {
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0xFFD700,
      emissiveIntensity: 0.2
    });

    const penny = new THREE.Mesh(geometry, material);
    penny.position.set(position.x, position.y + 0.5, position.z);
    penny.rotation.x = Math.PI / 2;
    penny.castShadow = true;
    penny.receiveShadow = true;
    penny.userData.id = id;

    this.scene.add(penny);
    this.pennies.set(id, penny);
  }

  private removePenny(id: string): void {
    const penny = this.pennies.get(id);
    if (penny) {
      // Animate collection
      const animate = () => {
        penny.position.y += 0.1;
        penny.rotation.z += 0.2;
        penny.scale.multiplyScalar(0.95);

        if (penny.scale.x > 0.1) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(penny);
          this.pennies.delete(id);
          this.ui.updatePenniesLeft(this.pennies.size);
        }
      };
      animate();
    }
  }

  private spawnOtherPlayer(id: string, position: { x: number; y: number; z: number }, walletAddress?: string): void {
    const playerGroup = new THREE.Group();

    // Skin color
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xE0C8A8,
      roughness: 0.8
    });

    // Clothing colors (random per player)
    const clothingColors = [0x1a1a1a, 0x2c2c2c, 0x0d0d0d, 0x1f1f1f];
    const clothingColor = clothingColors[Math.floor(Math.random() * clothingColors.length)];
    const clothingMaterial = new THREE.MeshStandardMaterial({
      color: clothingColor,
      roughness: 0.9
    });

    // Body - black coat/suit
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.8, 4, 8),
      clothingMaterial
    );
    body.position.y = 0.9;
    body.castShadow = true;
    playerGroup.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 12),
      skinMaterial
    );
    head.position.y = 1.65;
    head.castShadow = true;
    playerGroup.add(head);

    // Kippah (yarmulke)
    const kippahGeometry = new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3);
    const kippahMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.7
    });
    const kippah = new THREE.Mesh(kippahGeometry, kippahMaterial);
    kippah.position.y = 1.82;
    kippah.rotation.x = -0.1;
    playerGroup.add(kippah);

    // Beard
    const beardMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a1a0a,
      roughness: 0.9
    });
    const beard = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.25, 8),
      beardMaterial
    );
    beard.position.set(0, 1.45, 0.15);
    beard.rotation.x = Math.PI;
    playerGroup.add(beard);

    // Payot (sidelocks)
    [-1, 1].forEach(side => {
      const payot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.02, 0.3, 8),
        beardMaterial
      );
      payot.position.set(side * 0.2, 1.5, 0.1);
      payot.rotation.x = 0.2;
      playerGroup.add(payot);
    });

    // Nose
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.12, 8),
      skinMaterial
    );
    nose.position.set(0, 1.62, 0.22);
    nose.rotation.x = Math.PI / 2;
    playerGroup.add(nose);

    // Eyes
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2a1a });
    [-1, 1].forEach(side => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        eyeMaterial
      );
      eye.position.set(side * 0.08, 1.68, 0.2);
      playerGroup.add(eye);
    });

    // Arms
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.08, 0.5, 4, 8),
        clothingMaterial
      );
      arm.position.set(side * 0.4, 0.9, 0);
      arm.rotation.z = side * 0.2;
      arm.castShadow = true;
      playerGroup.add(arm);

      // Hand
      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        skinMaterial
      );
      hand.position.set(side * 0.5, 0.5, 0);
      playerGroup.add(hand);
    });

    // Legs
    [-1, 1].forEach(side => {
      const leg = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.1, 0.5, 4, 8),
        clothingMaterial
      );
      leg.position.set(side * 0.15, 0.3, 0);
      leg.castShadow = true;
      playerGroup.add(leg);

      // Shoe
      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.08, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
      );
      shoe.position.set(side * 0.15, 0.04, 0.05);
      playerGroup.add(shoe);
    });

    // Name tag with wallet address
    const wallet = walletAddress || 'Unknown';
    const displayName = wallet.slice(0, 4) + '...' + wallet.slice(-4);
    const nameTag = this.createNameTag(displayName);
    nameTag.position.y = 2.2;
    playerGroup.add(nameTag);

    // Store wallet for reference
    this.playerWallets.set(id, wallet);

    playerGroup.position.set(position.x, 0, position.z);
    this.scene.add(playerGroup);
    this.otherPlayers.set(id, playerGroup);
  }

  private createNameTag(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.roundRect(0, 0, 256, 64, 10);
    context.fill();

    // Border
    context.strokeStyle = '#FFD700';
    context.lineWidth = 3;
    context.roundRect(0, 0, 256, 64, 10);
    context.stroke();

    // Text
    context.fillStyle = '#FFD700';
    context.font = 'bold 28px Outfit, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1.5, 0.4, 1);

    return sprite;
  }

  private updateOtherPlayer(id: string, position: { x: number; y: number; z: number }, rotation: any): void {
    const player = this.otherPlayers.get(id);
    if (player) {
      player.position.set(position.x, 0, position.z);
      if (rotation) {
        player.rotation.y = rotation.y || 0;
      }
    }
  }

  private removeOtherPlayer(id: string): void {
    const player = this.otherPlayers.get(id);
    if (player) {
      this.scene.remove(player);
      this.otherPlayers.delete(id);
    }
  }

  private endGame(data: any): void {
    this.isPlaying = false;
    document.exitPointerLock();

    // Show results with proportional rewards
    if (data.totalTop3Coins !== undefined) {
      this.ui.showResultsWithProportional(data.rankings, data.winners, data.totalTop3Coins);
    } else {
      this.ui.showResults(data.rankings, data.winners);
    }
    this.ui.showScreen('results');

    // REMOVED: cooldown message - players can play again immediately
  }

  private resetGame(_data: any): void {
    // Clear world
    this.pennies.forEach(penny => this.scene.remove(penny));
    this.pennies.clear();

    this.otherPlayers.forEach(player => this.scene.remove(player));
    this.otherPlayers.clear();

    // Reset state
    this.myScore = 0;
    this.velocity.set(0, 0, 0);

    // Enable play again button
    const playAgainBtn = document.getElementById('play-again-btn') as HTMLButtonElement;
    if (playAgainBtn) {
      playAgainBtn.disabled = false;
    }
  }

  private updatePlayer(delta: number): void {
    if (!this.isPlaying || this.isSpectating) return;

    // Gravity
    this.velocity.y -= 30 * delta;

    // Movement direction
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    const speed = 5; // Reduced from 15 to 5 for realistic walking speed

    // Store previous position for collision
    const prevX = this.camera.position.x;
    const prevZ = this.camera.position.z;

    // Apply movement
    if (this.moveForward || this.moveBackward) {
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      this.camera.position.addScaledVector(forward, this.direction.z * speed * delta);
    }

    if (this.moveLeft || this.moveRight) {
      const right = new THREE.Vector3();
      this.camera.getWorldDirection(right);
      right.y = 0;
      right.normalize();
      right.cross(new THREE.Vector3(0, 1, 0));
      this.camera.position.addScaledVector(right, this.direction.x * speed * delta);
    }

    // Check collision with buildings
    if (this.checkBuildingCollision()) {
      // Revert position if colliding
      this.camera.position.x = prevX;
      this.camera.position.z = prevZ;
    }

    // Apply gravity
    this.camera.position.y += this.velocity.y * delta;

    // Ground collision
    if (this.camera.position.y < 1.7) {
      this.camera.position.y = 1.7;
      this.velocity.y = 0;
      this.canJump = true;
    }

    // Keep player in bounds - Updated for bigger map
    const bounds = 190; // Increased from 55 for 400x400 map
    this.camera.position.x = Math.max(-bounds, Math.min(bounds, this.camera.position.x));
    this.camera.position.z = Math.max(-bounds, Math.min(bounds, this.camera.position.z));

    // Send position to server
    this.socket.emit('player_move', {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      rotation: {
        x: this.euler.x,
        y: this.euler.y
      }
    });

    // Check for penny collection
    this.checkPennyCollection();
  }

  // Building collision detection - Updated for bigger map
  private checkBuildingCollision(): boolean {
    const playerPos = this.camera.position;
    const playerRadius = 0.5; // Player collision radius

    // Building positions and sizes (must match world.ts)
    const buildings = [
      // Original Israeli buildings
      { x: 30, z: 30, w: 10, d: 8 },
      { x: -30, z: 30, w: 10, d: 8 },
      { x: 30, z: -30, w: 10, d: 8 },
      { x: -30, z: -30, w: 10, d: 8 },
      { x: 45, z: 15, w: 10, d: 8 },
      { x: -45, z: 15, w: 10, d: 8 },
      { x: 45, z: -15, w: 10, d: 8 },
      { x: -45, z: -15, w: 10, d: 8 },
      { x: 15, z: 45, w: 10, d: 8 },
      { x: -15, z: 45, w: 10, d: 8 },
      { x: 15, z: -45, w: 10, d: 8 },
      { x: -15, z: -45, w: 10, d: 8 },
      // New buildings for bigger map
      { x: 80, z: 30, w: 10, d: 8 },
      { x: -80, z: 30, w: 10, d: 8 },
      { x: 80, z: -30, w: 10, d: 8 },
      { x: -80, z: -30, w: 10, d: 8 },
      { x: 30, z: 80, w: 10, d: 8 },
      { x: -30, z: 80, w: 10, d: 8 },
      { x: 30, z: -80, w: 10, d: 8 },
      { x: -30, z: -80, w: 10, d: 8 },
      { x: 100, z: 60, w: 10, d: 8 },
      { x: -100, z: 60, w: 10, d: 8 },
      { x: 100, z: -60, w: 10, d: 8 },
      { x: -100, z: -60, w: 10, d: 8 },
      { x: 60, z: 100, w: 10, d: 8 },
      { x: -60, z: 100, w: 10, d: 8 },
      { x: 60, z: -100, w: 10, d: 8 },
      { x: -60, z: -100, w: 10, d: 8 },
      { x: 120, z: 0, w: 10, d: 8 },
      { x: -120, z: 0, w: 10, d: 8 },
      { x: 0, z: 120, w: 10, d: 8 },
      { x: 0, z: -120, w: 10, d: 8 },
      // Synagogue
      { x: 0, z: -40, w: 18, d: 15 },
      // Western Wall
      { x: 0, z: 48, w: 32, d: 4 },
    ];

    for (const building of buildings) {
      const halfW = building.w / 2 + playerRadius;
      const halfD = building.d / 2 + playerRadius;

      if (
        playerPos.x > building.x - halfW &&
        playerPos.x < building.x + halfW &&
        playerPos.z > building.z - halfD &&
        playerPos.z < building.z + halfD
      ) {
        return true; // Collision detected
      }
    }

    return false;
  }

  private checkPennyCollection(): void {
    const playerPos = this.camera.position;
    const collectRadius = 1.5;

    this.pennies.forEach((penny, id) => {
      const distance = playerPos.distanceTo(penny.position);
      if (distance < collectRadius) {
        this.socket.emit('collect_penny', { pennyId: id });
      }
    });
  }

  private animatePennies(): void {
    const time = Date.now() * 0.001;

    this.pennies.forEach(penny => {
      // Floating animation
      penny.position.y = 0.6 + Math.sin(time * 2 + penny.position.x) * 0.1;
      // Rotation
      penny.rotation.z += 0.02;
    });
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const delta = 0.016; // ~60fps

    if (this.isPlaying) {
      this.updatePlayer(delta);
      this.animatePennies();
      this.renderer.render(this.scene, this.camera);
    }
  };
}

// Start the game when page loads
document.addEventListener('DOMContentLoaded', () => {
  new PennySnifferGame();
});
