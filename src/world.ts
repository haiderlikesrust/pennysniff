import * as THREE from 'three';

export class World {
    private scene: THREE.Scene;
    public doors: THREE.Mesh[] = []; // Public so main can access for interaction
    public doorStates: Map<THREE.Mesh, boolean> = new Map(); // Door open states

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    build(): void {
        this.createGround();
        this.createStreets();
        this.createIsraeliBuildings();
        this.createSynagogue();
        this.createMarketStalls();
        this.createTrashCans();
        this.createProps();
        this.createPalmTrees();
        this.createOliveTrees();
        this.createWesternWall();
        this.createFountain();
        this.createCamels();
        this.createFlags();
    }

    private createGround(): void {
        // Sandy/desert ground typical of Israel - BIGGER MAP for 20-25 players
        const mapSize = 400; // Doubled from 200
        const groundGeometry = new THREE.PlaneGeometry(mapSize, mapSize, 100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xD2B48C,
            roughness: 0.95
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add more rocky patches for bigger map
        for (let i = 0; i < 80; i++) {
            const rockGeometry = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.4, 0);
            const rockMaterial = new THREE.MeshStandardMaterial({
                color: Math.random() > 0.5 ? 0xA0826D : 0x8B7355,
                roughness: 0.9
            });
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            rock.position.set(
                (Math.random() - 0.5) * (mapSize - 20),
                0.15,
                (Math.random() - 0.5) * (mapSize - 20)
            );
            rock.scale.y = 0.5;
            rock.receiveShadow = true;
            rock.castShadow = true;
            this.scene.add(rock);
        }

        // Add more sand dunes for bigger map
        for (let i = 0; i < 16; i++) {
            const duneGeometry = new THREE.SphereGeometry(3 + Math.random() * 4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
            const duneMaterial = new THREE.MeshStandardMaterial({
                color: 0xC4A574,
                roughness: 1
            });
            const dune = new THREE.Mesh(duneGeometry, duneMaterial);
            const angle = (i / 16) * Math.PI * 2;
            const radius = 100 + Math.random() * 60;
            dune.position.set(
                Math.cos(angle) * radius + (Math.random() - 0.5) * 30,
                0,
                Math.sin(angle) * radius + (Math.random() - 0.5) * 30
            );
            dune.scale.y = 0.3;
            dune.receiveShadow = true;
            this.scene.add(dune);
        }
    }

    private createStreets(): void {
        // Cobblestone streets - typical of Jerusalem - BIGGER for larger map
        const streetMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B8378,
            roughness: 0.8
        });

        // Main street (longer for bigger map)
        const street1 = new THREE.Mesh(
            new THREE.PlaneGeometry(400, 10),
            streetMaterial
        );
        street1.rotation.x = -Math.PI / 2;
        street1.position.y = 0.02;
        street1.receiveShadow = true;
        this.scene.add(street1);

        // Cross street (longer for bigger map)
        const street2 = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 400),
            streetMaterial
        );
        street2.rotation.x = -Math.PI / 2;
        street2.position.y = 0.02;
        street2.receiveShadow = true;
        this.scene.add(street2);

        // Add cobblestone pattern texture effect (extended for bigger streets)
        for (let i = -195; i < 196; i += 2) {
            for (let j = -4; j < 5; j += 2) {
                if (Math.random() > 0.7) {
                    const stone = new THREE.Mesh(
                        new THREE.BoxGeometry(1.8, 0.02, 1.8),
                        new THREE.MeshStandardMaterial({
                            color: Math.random() > 0.5 ? 0x9B938B : 0x7B736B,
                            roughness: 0.9
                        })
                    );
                    stone.position.set(i + Math.random() * 0.3, 0.03, j + Math.random() * 0.3);
                    stone.receiveShadow = true;
                    this.scene.add(stone);
                }
            }
        }
    }

    private createIsraeliBuildings(): void {
        // More buildings spread across the bigger map
        const buildingPositions = [
            // Original positions
            { x: 30, z: 30 },
            { x: -30, z: 30 },
            { x: 30, z: -30 },
            { x: -30, z: -30 },
            { x: 45, z: 15 },
            { x: -45, z: 15 },
            { x: 45, z: -15 },
            { x: -45, z: -15 },
            { x: 15, z: 45 },
            { x: -15, z: 45 },
            { x: 15, z: -45 },
            { x: -15, z: -45 },
            // New buildings for bigger map
            { x: 80, z: 30 },
            { x: -80, z: 30 },
            { x: 80, z: -30 },
            { x: -80, z: -30 },
            { x: 30, z: 80 },
            { x: -30, z: 80 },
            { x: 30, z: -80 },
            { x: -30, z: -80 },
            { x: 100, z: 60 },
            { x: -100, z: 60 },
            { x: 100, z: -60 },
            { x: -100, z: -60 },
            { x: 60, z: 100 },
            { x: -60, z: 100 },
            { x: 60, z: -100 },
            { x: -60, z: -100 },
            // Even more outer buildings
            { x: 120, z: 0 },
            { x: -120, z: 0 },
            { x: 0, z: 120 },
            { x: 0, z: -120 },
        ];

        const stoneColors = [0xF5DEB3, 0xE8D4A8, 0xDCC9A3, 0xCFBF9E];

        buildingPositions.forEach((pos, index) => {
            const buildingGroup = new THREE.Group();

            const width = 8 + Math.random() * 2;
            const height = 5 + Math.random() * 3;
            const depth = 6 + Math.random() * 2;
            const color = stoneColors[index % stoneColors.length];

            // Main building
            const buildingMaterial = new THREE.MeshStandardMaterial({
                color,
                roughness: 0.85
            });
            const building = new THREE.Mesh(
                new THREE.BoxGeometry(width, height, depth),
                buildingMaterial
            );
            building.position.y = height / 2;
            building.castShadow = true;
            building.receiveShadow = true;
            buildingGroup.add(building);

            // Flat roof
            const roof = new THREE.Mesh(
                new THREE.BoxGeometry(width + 0.5, 0.3, depth + 0.5),
                new THREE.MeshStandardMaterial({ color: 0xEEE8DC, roughness: 0.9 })
            );
            roof.position.y = height + 0.15;
            roof.castShadow = true;
            buildingGroup.add(roof);

            // Door frame
            const doorFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
            const doorFrame = new THREE.Mesh(
                new THREE.BoxGeometry(1.6, 2.9, 0.15),
                doorFrameMaterial
            );
            doorFrame.position.set(0, 1.45, depth / 2 + 0.07);
            buildingGroup.add(doorFrame);

            // Actual door (animated)
            const doorMaterial = new THREE.MeshStandardMaterial({
                color: 0x5C4033,
                roughness: 0.8
            });
            const door = new THREE.Mesh(
                new THREE.BoxGeometry(1.3, 2.6, 0.1),
                doorMaterial
            );
            door.position.set(0, 1.3, depth / 2 + 0.15);
            door.userData.isDoor = true;
            door.userData.buildingPos = pos;
            buildingGroup.add(door);
            this.doors.push(door);
            this.doorStates.set(door, false); // Closed by default

            // Door handle
            const handle = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0xB8860B, metalness: 0.8 })
            );
            handle.position.set(0.5, 1.3, depth / 2 + 0.22);
            buildingGroup.add(handle);

            // Arched windows
            const windowPositions = [
                { x: width / 3, y: height / 2 + 0.5 },
                { x: -width / 3, y: height / 2 + 0.5 }
            ];

            windowPositions.forEach(wPos => {
                // Window frame
                const frame = new THREE.Mesh(
                    new THREE.BoxGeometry(1.2, 1.8, 0.1),
                    new THREE.MeshStandardMaterial({ color: 0x5C4033 })
                );
                frame.position.set(wPos.x, wPos.y, depth / 2 + 0.06);
                buildingGroup.add(frame);

                // Window glass
                const glass = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.9, 1.4),
                    new THREE.MeshStandardMaterial({
                        color: 0x4169E1,
                        metalness: 0.3,
                        roughness: 0.1,
                        transparent: true,
                        opacity: 0.7
                    })
                );
                glass.position.set(wPos.x, wPos.y, depth / 2 + 0.12);
                buildingGroup.add(glass);

                // Window shutters
                [-0.55, 0.55].forEach(offsetX => {
                    const shutter = new THREE.Mesh(
                        new THREE.BoxGeometry(0.3, 1.5, 0.05),
                        new THREE.MeshStandardMaterial({ color: 0x2E8B57 })
                    );
                    shutter.position.set(wPos.x + offsetX, wPos.y, depth / 2 + 0.08);
                    buildingGroup.add(shutter);
                });
            });

            // Star of David on some buildings
            if (index % 3 === 0) {
                const star = this.createStarOfDavid(0.6);
                star.position.set(0, height - 0.3, depth / 2 + 0.2);
                buildingGroup.add(star);
            }

            // Mezuzah on doorframe
            const mezuzah = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.25, 0.04),
                new THREE.MeshStandardMaterial({ color: 0xB8860B, metalness: 0.6 })
            );
            mezuzah.position.set(0.9, 2.2, depth / 2 + 0.1);
            mezuzah.rotation.z = 0.3;
            buildingGroup.add(mezuzah);

            // Balcony on some buildings
            if (index % 2 === 0) {
                const balcony = new THREE.Mesh(
                    new THREE.BoxGeometry(width * 0.6, 0.15, 1.5),
                    new THREE.MeshStandardMaterial({ color: 0xD4C4A8 })
                );
                balcony.position.set(0, height * 0.7, depth / 2 + 0.75);
                buildingGroup.add(balcony);

                // Balcony railing
                const railing = new THREE.Mesh(
                    new THREE.BoxGeometry(width * 0.6, 0.8, 0.05),
                    new THREE.MeshStandardMaterial({ color: 0x2F1F0F, metalness: 0.5 })
                );
                railing.position.set(0, height * 0.7 + 0.45, depth / 2 + 1.45);
                buildingGroup.add(railing);

                // Flower pots on balcony
                for (let p = 0; p < 3; p++) {
                    const pot = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.15, 0.12, 0.2, 8),
                        new THREE.MeshStandardMaterial({ color: 0xCD853F })
                    );
                    pot.position.set((p - 1) * 0.8, height * 0.7 + 0.2, depth / 2 + 1.2);
                    buildingGroup.add(pot);

                    // Flowers
                    const flower = new THREE.Mesh(
                        new THREE.SphereGeometry(0.2, 8, 8),
                        new THREE.MeshStandardMaterial({
                            color: [0xFF69B4, 0xFF4500, 0x9400D3][p % 3]
                        })
                    );
                    flower.position.set((p - 1) * 0.8, height * 0.7 + 0.4, depth / 2 + 1.2);
                    buildingGroup.add(flower);
                }
            }

            buildingGroup.position.set(pos.x, 0, pos.z);
            this.scene.add(buildingGroup);
        });
    }

    private createStarOfDavid(size: number): THREE.Group {
        const group = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({
            color: 0x0038B8,
            metalness: 0.3
        });

        const triangleShape = new THREE.Shape();
        triangleShape.moveTo(0, size);
        triangleShape.lineTo(-size * 0.866, -size * 0.5);
        triangleShape.lineTo(size * 0.866, -size * 0.5);
        triangleShape.closePath();

        const geometry = new THREE.ExtrudeGeometry(triangleShape, {
            depth: 0.05,
            bevelEnabled: false
        });

        const triangle1 = new THREE.Mesh(geometry, material);
        const triangle2 = new THREE.Mesh(geometry, material);
        triangle2.rotation.z = Math.PI;

        group.add(triangle1);
        group.add(triangle2);

        return group;
    }

    private createSynagogue(): void {
        const synagogue = new THREE.Group();

        // Main building
        const mainBuilding = new THREE.Mesh(
            new THREE.BoxGeometry(15, 8, 12),
            new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.8 })
        );
        mainBuilding.position.y = 4;
        mainBuilding.castShadow = true;
        synagogue.add(mainBuilding);

        // Dome
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({
                color: 0x0038B8,
                metalness: 0.4,
                roughness: 0.3
            })
        );
        dome.position.y = 8;
        dome.castShadow = true;
        synagogue.add(dome);

        // Star of David on top
        const star = this.createStarOfDavid(1.2);
        star.position.y = 13;
        star.rotation.x = -Math.PI / 2;
        synagogue.add(star);

        // Menorah at entrance
        const menorah = this.createMenorah();
        menorah.position.set(0, 0, 7);
        menorah.scale.setScalar(0.5);
        synagogue.add(menorah);

        // Pillars
        const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.6, 7, 8);
        const pillarMaterial = new THREE.MeshStandardMaterial({ color: 0xEEE8DC });

        [-5, 5].forEach(x => {
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(x, 3.5, 6.5);
            pillar.castShadow = true;
            synagogue.add(pillar);

            const capital = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 0.5, 1.2),
                pillarMaterial
            );
            capital.position.set(x, 7.25, 6.5);
            synagogue.add(capital);
        });

        // Grand door
        const doorFrame = new THREE.Mesh(
            new THREE.BoxGeometry(4, 6, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x3d2817 })
        );
        doorFrame.position.set(0, 3, 6.15);
        synagogue.add(doorFrame);

        const door = new THREE.Mesh(
            new THREE.BoxGeometry(3.5, 5.5, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.7 })
        );
        door.position.set(0, 2.75, 6.25);
        synagogue.add(door);

        // Stained glass windows
        [-4, 4].forEach(x => {
            const window = new THREE.Mesh(
                new THREE.CircleGeometry(1.5, 32),
                new THREE.MeshStandardMaterial({
                    color: 0x4169E1,
                    transparent: true,
                    opacity: 0.7,
                    emissive: 0x4169E1,
                    emissiveIntensity: 0.2
                })
            );
            window.position.set(x, 5, 6.05);
            synagogue.add(window);
        });

        synagogue.position.set(0, 0, -40);
        this.scene.add(synagogue);
    }

    private createMenorah(): THREE.Group {
        const menorah = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            metalness: 0.8,
            roughness: 0.2
        });

        // Base
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(1.5, 2, 0.5, 16),
            material
        );
        menorah.add(base);

        // Central stem
        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.15, 4, 8),
            material
        );
        stem.position.y = 2;
        menorah.add(stem);

        // Branches
        const branchPositions = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5];
        branchPositions.forEach((x, i) => {
            const height = i === 3 ? 4 : 3.5 - Math.abs(x) * 0.3;

            if (i !== 3) {
                const curve = new THREE.QuadraticBezierCurve3(
                    new THREE.Vector3(0, 1.5, 0),
                    new THREE.Vector3(x * 0.5, 2.5, 0),
                    new THREE.Vector3(x, height, 0)
                );
                const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.08, 8, false);
                const branch = new THREE.Mesh(tubeGeometry, material);
                menorah.add(branch);
            }

            // Candle holder
            const holder = new THREE.Mesh(
                new THREE.CylinderGeometry(0.12, 0.15, 0.3, 8),
                material
            );
            holder.position.set(x, height + 0.15, 0);
            menorah.add(holder);

            // Flame
            const flame = new THREE.Mesh(
                new THREE.ConeGeometry(0.08, 0.25, 8),
                new THREE.MeshStandardMaterial({
                    color: 0xFF6600,
                    emissive: 0xFF4400,
                    emissiveIntensity: 1
                })
            );
            flame.position.set(x, height + 0.45, 0);
            menorah.add(flame);
        });

        return menorah;
    }

    private createMarketStalls(): void {
        const stallPositions = [
            { x: 20, z: 8, rot: 0 },
            { x: -20, z: 8, rot: Math.PI },
            { x: 8, z: 20, rot: Math.PI / 2 },
            { x: -8, z: 20, rot: -Math.PI / 2 },
            { x: 25, z: -8, rot: 0 },
            { x: -25, z: -8, rot: Math.PI }
        ];

        const canopyColors = [0xFF0000, 0x0038B8, 0xFFFFFF, 0x228B22, 0xFFA500];

        stallPositions.forEach((pos, index) => {
            const stall = new THREE.Group();

            // Table
            const table = new THREE.Mesh(
                new THREE.BoxGeometry(3, 0.1, 2),
                new THREE.MeshStandardMaterial({ color: 0x8B4513 })
            );
            table.position.y = 1;
            stall.add(table);

            // Tablecloth
            const cloth = new THREE.Mesh(
                new THREE.BoxGeometry(3.2, 0.02, 2.2),
                new THREE.MeshStandardMaterial({
                    color: [0xFFFFFF, 0x87CEEB, 0xFFFACD][index % 3]
                })
            );
            cloth.position.y = 1.06;
            stall.add(cloth);

            // Poles
            [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]].forEach(([x, z]) => {
                const pole = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8),
                    new THREE.MeshStandardMaterial({ color: 0x4a3728 })
                );
                pole.position.set(x, 1.25, z);
                stall.add(pole);
            });

            // Canopy with stripes
            const canopyColor = canopyColors[index % canopyColors.length];
            const canopy = new THREE.Mesh(
                new THREE.BoxGeometry(3.2, 0.1, 2.2),
                new THREE.MeshStandardMaterial({ color: canopyColor })
            );
            canopy.position.y = 2.5;
            stall.add(canopy);

            // Fringe on canopy
            for (let f = 0; f < 8; f++) {
                const fringe = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4),
                    new THREE.MeshStandardMaterial({ color: canopyColor })
                );
                fringe.position.set((f - 3.5) * 0.4, 2.35, 1.1);
                stall.add(fringe);
            }

            // Goods on table
            const goods = ['sphere', 'cone', 'box'];
            for (let i = 0; i < 12; i++) {
                const type = goods[i % 3];
                let geometry: THREE.BufferGeometry;
                if (type === 'sphere') {
                    geometry = new THREE.SphereGeometry(0.1, 8, 8);
                } else if (type === 'cone') {
                    geometry = new THREE.ConeGeometry(0.08, 0.15, 8);
                } else {
                    geometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
                }

                const good = new THREE.Mesh(
                    geometry,
                    new THREE.MeshStandardMaterial({
                        color: [0xFF6347, 0xFFD700, 0x32CD32, 0xFF4500, 0x9400D3, 0xFF69B4][i % 6]
                    })
                );
                good.position.set(
                    (Math.random() - 0.5) * 2.5,
                    1.15 + (type === 'cone' ? 0.075 : 0.1),
                    (Math.random() - 0.5) * 1.5
                );
                stall.add(good);
            }

            // Sign
            const sign = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, 0.4, 0.05),
                new THREE.MeshStandardMaterial({ color: 0x4a3728 })
            );
            sign.position.set(0, 2.8, 0);
            stall.add(sign);

            stall.position.set(pos.x, 0, pos.z);
            stall.rotation.y = pos.rot;
            this.scene.add(stall);
        });
    }

    private createTrashCans(): void {
        const trashPositions = [
            { x: 12, z: 8 }, { x: -12, z: 8 },
            { x: 12, z: -8 }, { x: -12, z: -8 },
            { x: 8, z: 12 }, { x: -8, z: 12 },
            { x: 35, z: 8 }, { x: -35, z: 8 },
            { x: 8, z: 35 }, { x: -8, z: 35 }
        ];

        trashPositions.forEach(pos => {
            const trash = new THREE.Group();

            const can = new THREE.Mesh(
                new THREE.CylinderGeometry(0.4, 0.35, 1, 16),
                new THREE.MeshStandardMaterial({
                    color: 0x2F4F4F,
                    metalness: 0.5
                })
            );
            can.position.y = 0.5;
            can.castShadow = true;
            trash.add(can);

            const lid = new THREE.Mesh(
                new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16),
                new THREE.MeshStandardMaterial({ color: 0x2F4F4F, metalness: 0.5 })
            );
            lid.position.y = 1.04;
            trash.add(lid);

            // Some trash spilling out
            if (Math.random() > 0.5) {
                for (let t = 0; t < 3; t++) {
                    const paper = new THREE.Mesh(
                        new THREE.BoxGeometry(0.1, 0.1, 0.01),
                        new THREE.MeshStandardMaterial({ color: 0xFFFFE0 })
                    );
                    paper.position.set(
                        0.5 + Math.random() * 0.3,
                        0.1,
                        Math.random() * 0.3 - 0.15
                    );
                    paper.rotation.set(Math.random(), Math.random(), Math.random());
                    trash.add(paper);
                }
            }

            trash.position.set(pos.x, 0, pos.z);
            this.scene.add(trash);
        });
    }

    private createProps(): void {
        // Stone benches
        const benchPositions = [
            { x: 18, z: 6 }, { x: -18, z: 6 },
            { x: 6, z: 18 }, { x: -6, z: -18 }
        ];

        benchPositions.forEach(pos => {
            const bench = new THREE.Mesh(
                new THREE.BoxGeometry(2.5, 0.5, 0.8),
                new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.9 })
            );
            bench.position.set(pos.x, 0.25, pos.z);
            bench.castShadow = true;
            this.scene.add(bench);

            // Bench legs
            [-0.9, 0.9].forEach(offsetX => {
                const leg = new THREE.Mesh(
                    new THREE.BoxGeometry(0.2, 0.5, 0.8),
                    new THREE.MeshStandardMaterial({ color: 0xC4A98C })
                );
                leg.position.set(pos.x + offsetX, 0.25, pos.z);
                this.scene.add(leg);
            });
        });

        // Clay pots with plants
        const potPositions = [
            { x: 28, z: 28 }, { x: -28, z: 28 },
            { x: 28, z: -28 }, { x: -28, z: -28 },
            { x: 40, z: 10 }, { x: -40, z: 10 },
            { x: 10, z: 40 }, { x: -10, z: 40 }
        ];

        potPositions.forEach(pos => {
            const potGroup = new THREE.Group();

            const pot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.3, 0.4, 0.6, 12),
                new THREE.MeshStandardMaterial({ color: 0xCD853F, roughness: 0.9 })
            );
            pot.position.y = 0.3;
            potGroup.add(pot);

            // Dirt
            const dirt = new THREE.Mesh(
                new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12),
                new THREE.MeshStandardMaterial({ color: 0x4a3728 })
            );
            dirt.position.y = 0.55;
            potGroup.add(dirt);

            // Plant
            const plant = new THREE.Mesh(
                new THREE.SphereGeometry(0.35, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0x228B22 })
            );
            plant.position.y = 0.85;
            plant.scale.y = 0.8;
            potGroup.add(plant);

            potGroup.position.set(pos.x, 0, pos.z);
            this.scene.add(potGroup);
        });

        // Street lamps
        const lampPositions = [
            { x: 7, z: 15 }, { x: -7, z: 15 },
            { x: 7, z: -15 }, { x: -7, z: -15 },
            { x: 15, z: 7 }, { x: -15, z: 7 },
            { x: 15, z: -7 }, { x: -15, z: -7 }
        ];

        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x2F1F0F,
            metalness: 0.7,
            roughness: 0.3
        });

        lampPositions.forEach(pos => {
            const lampGroup = new THREE.Group();

            // Pole
            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.12, 4, 8),
                metalMaterial
            );
            pole.position.y = 2;
            pole.castShadow = true;
            lampGroup.add(pole);

            // Ornate top
            const top = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.5, 0.5),
                metalMaterial
            );
            top.position.y = 4.25;
            lampGroup.add(top);

            // Lantern
            const lantern = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.6, 0.4),
                new THREE.MeshStandardMaterial({
                    color: 0xFFFFE0,
                    transparent: true,
                    opacity: 0.8,
                    emissive: 0xFFFF99,
                    emissiveIntensity: 0.5
                })
            );
            lantern.position.y = 4;
            lampGroup.add(lantern);

            // Light
            const light = new THREE.PointLight(0xFFFFAA, 0.5, 15);
            light.position.y = 4;
            lampGroup.add(light);

            lampGroup.position.set(pos.x, 0, pos.z);
            this.scene.add(lampGroup);
        });
    }

    private createPalmTrees(): void {
        const palmPositions = [
            { x: 40, z: 40 }, { x: -40, z: 40 },
            { x: 40, z: -40 }, { x: -40, z: -40 },
            { x: 50, z: 0 }, { x: -50, z: 0 },
            { x: 0, z: 50 }, { x: 0, z: -50 },
            { x: 55, z: 25 }, { x: -55, z: 25 },
            { x: 55, z: -25 }, { x: -55, z: -25 }
        ];

        palmPositions.forEach(pos => {
            const palm = new THREE.Group();
            const scale = 0.9 + Math.random() * 0.3;

            // Trunk
            const trunkSegments = 8;
            for (let i = 0; i < trunkSegments; i++) {
                const segment = new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.25 - i * 0.02,
                        0.3 - i * 0.02,
                        0.8,
                        8
                    ),
                    new THREE.MeshStandardMaterial({
                        color: i % 2 === 0 ? 0x8B7355 : 0x7A6245,
                        roughness: 0.95
                    })
                );
                segment.position.y = i * 0.75 + 0.4;
                palm.add(segment);
            }

            // Coconuts
            for (let c = 0; c < 3; c++) {
                const coconut = new THREE.Mesh(
                    new THREE.SphereGeometry(0.15, 8, 8),
                    new THREE.MeshStandardMaterial({ color: 0x5C4033 })
                );
                const angle = (c / 3) * Math.PI * 2;
                coconut.position.set(
                    Math.cos(angle) * 0.3,
                    trunkSegments * 0.75 + 0.2,
                    Math.sin(angle) * 0.3
                );
                palm.add(coconut);
            }

            // Palm fronds
            const frondMaterial = new THREE.MeshStandardMaterial({
                color: 0x228B22,
                side: THREE.DoubleSide
            });

            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2;
                const frondGroup = new THREE.Group();

                const frond = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.4, 4),
                    frondMaterial
                );
                frond.position.y = 2;
                frond.rotation.x = -Math.PI / 3.5;
                frondGroup.add(frond);

                frondGroup.position.y = trunkSegments * 0.75;
                frondGroup.rotation.y = angle;
                palm.add(frondGroup);
            }

            palm.position.set(pos.x, 0, pos.z);
            palm.scale.setScalar(scale);
            this.scene.add(palm);
        });
    }

    private createOliveTrees(): void {
        const olivePositions = [
            { x: 35, z: 20 }, { x: -35, z: 20 },
            { x: 35, z: -20 }, { x: -35, z: -20 },
            { x: 20, z: 35 }, { x: -20, z: 35 },
            { x: 20, z: -35 }, { x: -20, z: -35 }
        ];

        olivePositions.forEach(pos => {
            const tree = new THREE.Group();
            const scale = 0.8 + Math.random() * 0.4;

            // Gnarled trunk
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.3, 0.5, 2.5 * scale, 8),
                new THREE.MeshStandardMaterial({ color: 0x5D4E37, roughness: 0.95 })
            );
            trunk.position.y = 1.25 * scale;
            trunk.rotation.z = (Math.random() - 0.5) * 0.2;
            trunk.castShadow = true;
            tree.add(trunk);

            // Multiple foliage clumps
            const foliagePositions = [
                { x: 0, y: 3.5, z: 0, s: 1 },
                { x: 1, y: 3, z: 0.5, s: 0.6 },
                { x: -0.8, y: 3.2, z: -0.5, s: 0.5 },
            ];

            foliagePositions.forEach(fp => {
                const foliage = new THREE.Mesh(
                    new THREE.SphereGeometry(1.5 * fp.s * scale, 8, 6),
                    new THREE.MeshStandardMaterial({ color: 0x6B8E23, roughness: 0.8 })
                );
                foliage.position.set(fp.x * scale, fp.y * scale, fp.z * scale);
                foliage.scale.y = 0.6;
                foliage.castShadow = true;
                tree.add(foliage);
            });

            tree.position.set(pos.x, 0, pos.z);
            this.scene.add(tree);
        });
    }

    private createWesternWall(): void {
        const wall = new THREE.Group();

        // Main wall structure
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xE8D4A8,
            roughness: 0.9
        });

        const mainWall = new THREE.Mesh(
            new THREE.BoxGeometry(30, 12, 2),
            wallMaterial
        );
        mainWall.position.y = 6;
        mainWall.castShadow = true;
        mainWall.receiveShadow = true;
        wall.add(mainWall);

        // Stone block details
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 10; col++) {
                const blockColor = (row + col) % 2 === 0 ? 0xE8D4A8 : 0xD8C498;
                const block = new THREE.Mesh(
                    new THREE.BoxGeometry(2.8, 1.8, 0.3),
                    new THREE.MeshStandardMaterial({
                        color: blockColor,
                        roughness: 0.95
                    })
                );
                block.position.set(
                    col * 3 - 13.5,
                    row * 2 + 1,
                    1.1
                );
                wall.add(block);
            }
        }

        // Prayer notes (kvitlach) in cracks
        for (let i = 0; i < 30; i++) {
            const note = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.1, 0.02),
                new THREE.MeshStandardMaterial({ color: 0xFFFFF0 })
            );
            note.position.set(
                (Math.random() - 0.5) * 28,
                Math.random() * 10 + 1,
                1.25
            );
            note.rotation.z = (Math.random() - 0.5) * 0.5;
            wall.add(note);
        }

        // Prayer stands
        [-10, 0, 10].forEach(x => {
            const stand = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1.2, 0.3),
                new THREE.MeshStandardMaterial({ color: 0x4a3728 })
            );
            stand.position.set(x, 0.6, 2.5);
            wall.add(stand);
        });

        wall.position.set(0, 0, 50);
        wall.rotation.y = Math.PI;
        this.scene.add(wall);
    }

    private createFountain(): void {
        const fountain = new THREE.Group();

        // Base
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(3, 3.5, 0.5, 32),
            new THREE.MeshStandardMaterial({ color: 0xD4C4A8, roughness: 0.8 })
        );
        base.position.y = 0.25;
        fountain.add(base);

        // Water basin
        const basin = new THREE.Mesh(
            new THREE.CylinderGeometry(2.5, 2.8, 0.8, 32),
            new THREE.MeshStandardMaterial({ color: 0xC4B498 })
        );
        basin.position.y = 0.7;
        fountain.add(basin);

        // Water
        const water = new THREE.Mesh(
            new THREE.CylinderGeometry(2.3, 2.3, 0.1, 32),
            new THREE.MeshStandardMaterial({
                color: 0x4169E1,
                transparent: true,
                opacity: 0.7,
                metalness: 0.3
            })
        );
        water.position.y = 1.05;
        fountain.add(water);

        // Center pillar
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.4, 2, 16),
            new THREE.MeshStandardMaterial({ color: 0xD4C4A8 })
        );
        pillar.position.y = 1.5;
        fountain.add(pillar);

        // Top bowl
        const topBowl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.8, 0.6, 0.4, 16),
            new THREE.MeshStandardMaterial({ color: 0xC4B498 })
        );
        topBowl.position.y = 2.7;
        fountain.add(topBowl);

        fountain.position.set(0, 0, 0);
        this.scene.add(fountain);
    }

    private createCamels(): void {
        const camelPositions = [
            { x: 55, z: 35, rot: -1 },
            { x: -55, z: -35, rot: 2 }
        ];

        camelPositions.forEach(pos => {
            const camel = new THREE.Group();

            const camelColor = 0xC19A6B;
            const camelMaterial = new THREE.MeshStandardMaterial({
                color: camelColor,
                roughness: 0.9
            });

            // Body
            const body = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.8, 2, 8, 16),
                camelMaterial
            );
            body.rotation.z = Math.PI / 2;
            body.position.y = 1.5;
            camel.add(body);

            // Humps
            [0.3, -0.5].forEach(offset => {
                const hump = new THREE.Mesh(
                    new THREE.SphereGeometry(0.5, 8, 8),
                    camelMaterial
                );
                hump.position.set(offset, 2.3, 0);
                hump.scale.set(0.8, 1, 0.6);
                camel.add(hump);
            });

            // Neck
            const neck = new THREE.Mesh(
                new THREE.CylinderGeometry(0.25, 0.3, 1.5, 8),
                camelMaterial
            );
            neck.position.set(1.2, 2.2, 0);
            neck.rotation.z = -0.5;
            camel.add(neck);

            // Head
            const head = new THREE.Mesh(
                new THREE.SphereGeometry(0.35, 8, 8),
                camelMaterial
            );
            head.position.set(1.8, 2.8, 0);
            head.scale.x = 1.3;
            camel.add(head);

            // Legs
            [[-0.7, -0.3], [-0.7, 0.3], [0.7, -0.3], [0.7, 0.3]].forEach(([x, z]) => {
                const leg = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.12, 0.1, 1.5, 8),
                    camelMaterial
                );
                leg.position.set(x, 0.75, z);
                camel.add(leg);
            });

            // Saddle blanket
            const blanket = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 0.1, 1),
                new THREE.MeshStandardMaterial({ color: 0xFF0000 })
            );
            blanket.position.set(-0.1, 2.5, 0);
            camel.add(blanket);

            camel.position.set(pos.x, 0, pos.z);
            camel.rotation.y = pos.rot;
            this.scene.add(camel);
        });
    }

    private createFlags(): void {
        // Israeli flags at key locations
        const flagPositions = [
            { x: 8, z: -35 },
            { x: -8, z: -35 },
            { x: 0, z: 8 }
        ];

        flagPositions.forEach(pos => {
            const flagGroup = new THREE.Group();

            // Pole
            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.06, 6, 8),
                new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 })
            );
            pole.position.y = 3;
            flagGroup.add(pole);

            // Flag - white with blue stripes
            const flag = new THREE.Group();

            // White background
            const white = new THREE.Mesh(
                new THREE.PlaneGeometry(2, 1.2),
                new THREE.MeshStandardMaterial({
                    color: 0xFFFFFF,
                    side: THREE.DoubleSide
                })
            );
            flag.add(white);

            // Blue stripes
            [-0.4, 0.4].forEach(y => {
                const stripe = new THREE.Mesh(
                    new THREE.PlaneGeometry(2, 0.15),
                    new THREE.MeshStandardMaterial({
                        color: 0x0038B8,
                        side: THREE.DoubleSide
                    })
                );
                stripe.position.set(0, y, 0.01);
                flag.add(stripe);
            });

            // Star of David
            const star = this.createStarOfDavid(0.25);
            star.position.z = 0.02;
            flag.add(star);

            flag.position.set(1.1, 5.4, 0);
            flagGroup.add(flag);

            // Gold ball on top
            const ball = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8 })
            );
            ball.position.y = 6.1;
            flagGroup.add(ball);

            flagGroup.position.set(pos.x, 0, pos.z);
            this.scene.add(flagGroup);
        });
    }

    // Toggle door open/close
    public toggleDoor(door: THREE.Mesh): void {
        const isOpen = this.doorStates.get(door) || false;
        const targetRotation = isOpen ? 0 : -Math.PI / 2;

        // Animate door
        const animate = () => {
            const currentRot = door.rotation.y;
            const diff = targetRotation - currentRot;

            if (Math.abs(diff) > 0.05) {
                door.rotation.y += diff * 0.1;
                requestAnimationFrame(animate);
            } else {
                door.rotation.y = targetRotation;
                this.doorStates.set(door, !isOpen);
            }
        };
        animate();
    }
}
