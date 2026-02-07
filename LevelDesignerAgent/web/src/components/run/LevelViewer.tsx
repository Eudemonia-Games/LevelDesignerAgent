
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, useGLTF, PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { fetchApi } from '../../api';

// --- Types (Partial, based on seed.ts) ---
interface LayoutPlan {
    room: { width: number; height: number; };
    tile_plan: {
        role: string;
        variant_count: number;
    }[];
}

interface PlacementPlan {
    pillar_instances: Array<{ x: number; y: number; }>;
    prop_instances: Array<{ prop_id: string; x: number; y: number; rotation?: number }>;
    boss_instance: { boss_id: string; x: number; y: number; rotation?: number };
}

interface AssetMap {
    [key: string]: string; // role/id -> url
}

// --- Components ---

function Tile({ url, position, rotation = 0 }: { url?: string, position: [number, number, number], rotation?: number }) {
    const gltf = useGLTF(url || '');
    const scene = useMemo(() => url ? gltf.scene.clone() : null, [gltf, url]);

    if (!url || !scene) return (
        <mesh position={position}>
            <boxGeometry args={[1, 0.1, 1]} />
            <meshStandardMaterial color="#333" />
        </mesh>
    );

    return <primitive object={scene} position={position} rotation={[0, rotation, 0]} />;
}

function Prop({ url, position, rotation = 0, scale = 1 }: { url?: string, position: [number, number, number], rotation?: number, scale?: number }) {
    const gltf = useGLTF(url || '');
    const scene = useMemo(() => url ? gltf.scene.clone() : null, [gltf, url]);

    if (!url || !scene) return (
        <mesh position={position}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="orange" />
        </mesh>
    );
    return <primitive object={scene} position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]} />;
}

function ExteriorModel({ url }: { url?: string }) {
    const gltf = useGLTF(url || '');
    const scene = useMemo(() => url ? gltf.scene.clone() : null, [gltf, url]);

    if (!url || !scene) return (
        <mesh position={[0, 0, 0]}>
            <boxGeometry args={[5, 5, 5]} />
            <meshStandardMaterial color="#555" />
        </mesh>
    );

    // Scale up exterior maybe? S10 is usually small or big depending on prompt.
    return <primitive object={scene} position={[0, 0, 0]} />;
}

// WASD Movement Logic
function PlayerController({ startPos }: { startPos: [number, number, number] }) {
    const { camera } = useThree();
    const [move, setMove] = useState({ forward: false, backward: false, left: false, right: false });
    const velocity = useRef(new THREE.Vector3());
    const direction = useRef(new THREE.Vector3());

    useEffect(() => {
        camera.position.set(...startPos);

        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': setMove(m => ({ ...m, forward: true })); break;
                case 'KeyS': setMove(m => ({ ...m, backward: true })); break;
                case 'KeyA': setMove(m => ({ ...m, left: true })); break;
                case 'KeyD': setMove(m => ({ ...m, right: true })); break;
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': setMove(m => ({ ...m, forward: false })); break;
                case 'KeyS': setMove(m => ({ ...m, backward: false })); break;
                case 'KeyA': setMove(m => ({ ...m, left: false })); break;
                case 'KeyD': setMove(m => ({ ...m, right: false })); break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
        }
    }, [startPos, camera]);

    useFrame((_, delta) => {
        const speed = 5.0; // m/s

        direction.current.z = Number(move.forward) - Number(move.backward);
        direction.current.x = Number(move.left) - Number(move.right);
        direction.current.normalize();

        if (move.forward || move.backward) velocity.current.z = direction.current.z * speed * delta;
        else velocity.current.z = 0;

        if (move.left || move.right) velocity.current.x = direction.current.x * speed * delta;
        else velocity.current.x = 0;

        camera.translateX(velocity.current.x);
        camera.translateZ(-velocity.current.z);

        camera.position.y = 1.6;
    });

    return null;
}


export function LevelViewer({ runId, onClose }: { runId: string; onClose: () => void }) {
    const [layout, setLayout] = useState<LayoutPlan | null>(null);
    const [placement, setPlacement] = useState<PlacementPlan | null>(null);
    const [assets, setAssets] = useState<AssetMap>({});
    const [loading, setLoading] = useState(true);

    const [mode, setMode] = useState<'exterior' | 'interior'>('exterior');

    useEffect(() => {
        async function load() {
            try {
                const stagesData = await fetchApi(`/api/v1/runs/${runId}/stages`);
                const stages = stagesData.stages || [];

                const s2 = stages.find((s: any) => s.stage_key === 'S2_LAYOUT_PLAN');
                if (s2 && s2.output_json) setLayout(s2.output_json);

                const s4 = stages.find((s: any) => s.stage_key === 'S4_PLACEMENT_PLAN');
                if (s4 && s4.output_json) setPlacement(s4.output_json);

                const assetMap: AssetMap = {};

                const fetchAssetUrl = async (stageKey: string, key: string) => {
                    const stage = stages.find((s: any) => s.stage_key === stageKey);
                    if (stage && stage.produced_artifacts_json && stage.produced_artifacts_json.length > 0) {
                        const assetId = stage.produced_artifacts_json[0];
                        try {
                            const urlData = await fetchApi(`/api/v1/assets/${assetId}/url`);
                            if (urlData.url) assetMap[key] = urlData.url;
                        } catch (e) { console.warn(`Failed to fetch url for ${key}`, e); }
                    }
                };

                await Promise.all([
                    fetchAssetUrl('S10_EXTERIOR_3D_MODEL', 'exterior'),
                    fetchAssetUrl('S11_TILE_3D_MODELS', 'floor'),
                    fetchAssetUrl('S12_PROP_3D_MODELS', 'prop_generic'),
                    fetchAssetUrl('S13_BOSS_3D_MODEL', 'boss')
                ]);

                setAssets(assetMap);

            } catch (err) {
                console.error("Failed to load level data", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [runId]);

    if (loading) return <div style={{ color: 'white' }}>Loading 3D Scene...</div>;

    const width = layout?.room?.width || 10;
    const height = layout?.room?.height || 10;

    const spawnX = -width / 2 + 2;
    const spawnZ = -height / 2 + 2;

    return (
        <div style={{ width: '100%', height: '100%', background: '#111', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: '10px' }}>
                <button
                    onClick={onClose}
                    style={{ padding: '8px 16px', background: '#333', color: 'white', border: '1px solid #555', cursor: 'pointer' }}
                >
                    Back
                </button>
                <button
                    onClick={() => setMode(mode === 'exterior' ? 'interior' : 'exterior')}
                    style={{ padding: '8px 16px', background: '#0284c7', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    {mode === 'exterior' ? 'Enter Dungeon' : 'Exit to Exterior'}
                </button>
            </div>

            {mode === 'interior' && (
                <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 10, color: 'rgba(255,255,255,0.7)', userSelect: 'none' }}>
                    WASD to Move &bull; Mouse to Look &bull; ESC to unlock cursor
                </div>
            )}

            <Canvas>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 20, 10]} intensity={1} />
                <Environment preset="city" />

                {mode === 'exterior' ? (
                    <>
                        <ExteriorModel url={assets['exterior']} />
                        <Grid args={[20, 20]} cellSize={1} cellThickness={1} cellColor="#444" sectionSize={5} />
                        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
                    </>
                ) : (
                    <>
                        <group position={[-width / 2, 0, -height / 2]}>
                            <Grid args={[width, height]} cellSize={1} cellThickness={1} cellColor="#6f6f6f" sectionSize={5} position={[width / 2, 0.01, height / 2]} />

                            {/* Floor Tiles */}
                            {layout && Array.from({ length: width * height }).map((_, i) => {
                                const x = i % width;
                                const y = Math.floor(i / width);
                                return (
                                    <Tile
                                        key={`tile-${i}`}
                                        position={[x + 0.5, 0, y + 0.5]}
                                        url={assets['floor']}
                                    />
                                );
                            })}

                            {/* Props */}
                            {placement?.prop_instances?.map((prop, i) => (
                                <Prop
                                    key={`prop-${i}`}
                                    position={[prop.x + 0.5, 0.1, prop.y + 0.5]}
                                    url={assets['prop_generic']}
                                />
                            ))}

                            {/* Boss */}
                            {placement?.boss_instance && (
                                <Prop
                                    position={[placement.boss_instance.x + 0.5, 0.1, placement.boss_instance.y + 0.5]}
                                    url={assets['boss']}
                                    scale={2}
                                />
                            )}
                        </group>

                        <PlayerController startPos={[spawnX, 1.6, spawnZ]} />
                        <PointerLockControls />
                    </>
                )}
            </Canvas>
        </div>
    );
}
