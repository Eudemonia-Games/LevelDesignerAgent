import { FlowsDb, UpsertStageParams } from './flows';

const DEFAULT_STAGES: (UpsertStageParams & { stage_key: string })[] = [
    {
        flow_version_id: '', // Set at runtime
        stage_key: 'S1_PROMPT_ENHANCE',
        order_index: 10,
        kind: 'llm',
        provider: 'gemini',
        model_id: 'gemini-2.0-flash', // Using flash for speed/cost in v0, design doc says pro but configurable
        prompt_template: `You are the "Level Design Agent" prompt enhancer.

We are generating ONE boss room interior (grid-based) and ONE exterior building shell, plus a static boss mesh.

User prompt:
{{user_prompt}}

Hard constraints (do not violate):
{{json constraints}}

Supported tile roles:
{{json tile_roles_supported}}

Supported prop categories:
{{json prop_categories_supported}}

Task:
1) Rewrite the prompt into an "enhanced prompt" that is precise and usable to drive consistent generation across multiple stages.
2) Produce a style guide that is concrete: architectural motifs, materials, palette, lighting, mood, prop motifs, and what to avoid.
3) Keep it grounded to a "structure" (building) outside, and a boss room inside.

Return JSON ONLY in this exact shape:
{
  "enhanced_prompt": "...",
  "style_guide": {
    "theme": "...",
    "setting": "...",
    "time_period": "...",
    "mood": "...",
    "color_palette": ["..."],
    "materials": ["..."],
    "lighting_notes": ["..."],
    "architectural_motifs": ["..."],
    "prop_motifs": ["..."],
    "camera_notes": ["..."],
    "avoid": ["..."]
  },
  "do_not_generate": ["..."],
  "keywords": ["..."]
}`,
        output_schema_json: {
            "type": "object",
            "properties": {
                "enhanced_prompt": { "type": "string" },
                "style_guide": { "type": "object" },
                "do_not_generate": { "type": "array", "items": { "type": "string" } },
                "keywords": { "type": "array", "items": { "type": "string" } }
            },
            "required": ["enhanced_prompt", "style_guide"]
        },
        input_bindings_json: {
            "user_prompt": "$.user_prompt",
            "constraints": "$.constraints",
            "tile_roles_supported": "$.tile_roles_supported",
            "prop_categories_supported": "$.prop_categories_supported"
        },
        breakpoint_after: true
    },
    {
        flow_version_id: '',
        stage_key: 'S2_LAYOUT_PLAN',
        order_index: 20,
        kind: 'llm',
        provider: 'gemini',
        model_id: 'gemini-2.0-flash',
        prompt_template: `You are the "Level Design Agent" layout planner.

Enhanced prompt:
{{enhanced_prompt}}

Style guide:
{{json style_guide}}

Hard constraints:
{{json constraints}}

Tile roles supported (closed set):
{{json tile_roles_supported}}

Prop categories supported (closed set):
{{json prop_categories_supported}}

We are generating ONE rectangular boss room on a 2m grid.
- No corner wall tiles allowed.
- Pillars may be placed at corners or cell centers.
- Wall separators are optional trims placed between wall segments.
- Max props: {{constraints.max_props}}

Your task:
1) Choose room width/height in CELLS (integers), within min/max bounds.
2) Choose wall height and ceiling height (meters).
3) Define 1 doorway on the boundary edges. Optionally define windows.
4) Define tile roles to generate (always include floor, wall, roof, doorway; windows/pillars/separators/niches optional).
5) For each tile role define:
   - variant_count (1-{{constraints.max_tile_variants_per_role}})
   - a text "tile_visual_prompt" describing how the tile should look (style, materials, motifs)
   - a "tile_geometry_role" that matches one of the tile roles (used to pick geometry reference image)
   - target triangle range for the tile (usually {{constraints.tile_poly_target_range}})
6) Define up to {{constraints.max_props}} props, each with:
   - prop_id (stable slug)
   - name
   - category (must be one of supported categories)
   - short visual prompt
   - desired_dimensions_m: {w,h,d} meters (reasonable for a boss room)
   - poly_target (10k-50k)
   - is_surface_support boolean (true only for GROUND_SURFACE)
   - allowed_support_ids (for ON_SURFACE props; list of surface prop_ids)
7) Define ONE boss:
   - boss_id
   - name
   - visual prompt
   - desired_dimensions_m
   - poly_target within boss range (80k-200k)

Return JSON ONLY matching the exact shape required by the system (room, openings, tile_plan, prop_plan, boss_plan, notes_for_placement).`,
        input_bindings_json: {
            "enhanced_prompt": "$.context.S1_PROMPT_ENHANCE.enhanced_prompt",
            "style_guide": "$.context.S1_PROMPT_ENHANCE.style_guide",
            "constraints": "$.constraints",
            "tile_roles_supported": "$.tile_roles_supported",
            "prop_categories_supported": "$.prop_categories_supported"
        },
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S2_ANCHOR_PROMPTS',
        order_index: 25,
        kind: 'llm',
        provider: 'gemini',
        model_id: 'gemini-2.0-flash',
        prompt_template: `You are the "Level Design Agent" anchor prompt writer.

Enhanced prompt:
{{enhanced_prompt}}

Style guide:
{{json style_guide}}

Layout plan:
{{json layout_plan}}

Task:
Write TWO image-generation prompts:
1) Exterior building hero shot (single structure). Should clearly read as the dungeon entrance. No characters.
2) Interior style reference shot of the boss room atmosphere (not a top-down map). No characters.

Constraints:
- Avoid text/logos/watermarks in images.
- Use language that produces consistent architecture and materials.

Return JSON ONLY:
{
  "exterior_image_prompt": "...",
  "exterior_aspect_ratio": "16:9",
  "interior_style_image_prompt": "...",
  "interior_aspect_ratio": "16:9"
}`,
        input_bindings_json: {
            "enhanced_prompt": "$.context.S1_PROMPT_ENHANCE.enhanced_prompt",
            "style_guide": "$.context.S1_PROMPT_ENHANCE.style_guide",
            "layout_plan": "$.context.S2_LAYOUT_PLAN"
        },
        breakpoint_after: true
    },
    {
        flow_version_id: '',
        stage_key: 'S3_RENDER_GRID_IMAGE',
        order_index: 30,
        kind: 'code',
        provider: 'internal',
        prompt_template: '', // Code stage
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S4_PLACEMENT_PLAN',
        order_index: 40,
        kind: 'llm',
        provider: 'gemini',
        model_id: 'gemini-2.0-flash',
        prompt_template: `You are the "Level Design Agent" placement planner.

You will receive a grid image showing the room layout with labeled coordinates.

Hard constraints:
{{json constraints}}

Layout plan:
{{json layout_plan}}

Style guide:
{{json style_guide}}

Notes from layout stage:
{{json layout_plan.notes_for_placement}}

Task:
1) Place pillars (corner and/or cell center). Use pillars to frame the boss area and hide wall seams.
2) Place props according to their categories:
   - ground_non_surface: place on floor cells
   - ground_surface: place on floor cells and use them as supports
   - on_surface: must reference an existing ground_surface instance_id
   - wall_hang: must reference a boundary edge and specify a height band (LOW/MID/HIGH)
   - ceiling_hang: must reference a cell and specify drop length class (SHORT/MED/LONG)
3) Place the boss in a strong focal position (typically opposite the doorway).
4) Provide facing direction for key props and boss (dir: N/S/E/W).
5) Do NOT block the doorway.
6) Keep it sparse enough to navigate.

Return JSON ONLY matching the expected schema (pillar_instances, wall_separator_instances, prop_instances, boss_instance).`,
        input_bindings_json: {
            "layout_plan": "$.context.S2_LAYOUT_PLAN",
            "style_guide": "$.context.S1_PROMPT_ENHANCE.style_guide",
            "constraints": "$.constraints"
        },
        attachments_policy_json: {
            "S3_RENDER_GRID_IMAGE": "required"
        },
        breakpoint_after: true
    },
    {
        flow_version_id: '',
        stage_key: 'S5_EXTERIOR_ANCHOR_IMAGE',
        order_index: 50,
        kind: 'image',
        provider: 'fal',
        model_id: 'fal-ai/flux-pro/v1.1-ultra', // Using Flux
        prompt_template: '{{exterior_image_prompt}}',
        input_bindings_json: {
            "exterior_image_prompt": "$.context.S2_ANCHOR_PROMPTS.exterior_image_prompt"
        },
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S6_INTERIOR_STYLE_IMAGE',
        order_index: 60,
        kind: 'image',
        provider: 'fal',
        model_id: 'fal-ai/flux-pro/v1.1-ultra',
        prompt_template: '{{interior_style_image_prompt}}',
        input_bindings_json: {
            "interior_style_image_prompt": "$.context.S2_ANCHOR_PROMPTS.interior_style_image_prompt"
        },
        breakpoint_after: true
    },
    {
        flow_version_id: '',
        stage_key: 'S7_TILE_IMAGES',
        order_index: 70,
        kind: 'image',
        provider: 'gemini', // Design doc says image batch, usually Gemini or Fal
        model_id: 'imagen-3.0-generate-001', // Placeholder for "gemini-2.5-flash-image"
        prompt_template: `Create a clean, well-lit reference image of a dungeon tile.

Tile role: {{tile_role}}
Variant: {{variant_index}}/{{variant_count}}

Style constraints:
{{json style_guide}}

Tile visual prompt:
{{tile_visual_prompt}}

Requirements:
- The tile should match the interior style reference image.
- The geometry should match the provided geometry reference image for this tile role.
- Neutral background, no text, no logos, no characters.
- Camera: slightly angled or orthographic that clearly shows shape and surface details.
- Focus on consistent materials and motifs for a cohesive tileset.`,
        input_bindings_json: {
            "style_guide": "$.context.S1_PROMPT_ENHANCE.style_guide"
        },
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S8_PROP_IMAGES',
        order_index: 80,
        kind: 'image',
        provider: 'gemini',
        model_id: 'imagen-3.0-generate-001',
        prompt_template: `Create a reference image for a single dungeon prop.

Prop name: {{prop_name}}
Prop category: {{prop_category}}
Desired size (meters): {{json desired_dimensions_m}}

Style constraints:
{{json style_guide}}

Prop visual prompt:
{{prop_visual_prompt}}

Requirements:
- Must match the interior style reference image.
- Single object, centered, neutral background, no characters, no text/logos.
- Show enough detail for 3D reconstruction.
- Avoid thin floating parts unless necessary.`,
        input_bindings_json: {
            "style_guide": "$.context.S1_PROMPT_ENHANCE.style_guide"
        },
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S9_BOSS_IMAGE',
        order_index: 90,
        kind: 'image',
        provider: 'gemini',
        model_id: 'imagen-3.0-generate-001',
        prompt_template: `Create a concept image of a single boss creature/statue/guardian for a dungeon boss room.

Boss name: {{boss_name}}
Desired size (meters): {{json desired_dimensions_m}}

Style constraints:
{{json style_guide}}

Boss visual prompt:
{{boss_visual_prompt}}

Requirements:
- Single subject, no other characters.
- Full body visible.
- High detail design suitable for a high poly static model.
- Neutral-ish background (not a full scene), no text/logos.`,
        input_bindings_json: {
            "style_guide": "$.context.S1_PROMPT_ENHANCE.style_guide"
        },
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S10_EXTERIOR_3D_MODEL',
        order_index: 100,
        kind: 'model3d',
        provider: 'rodin', // Fallback meshy
        model_id: '',
        prompt_template: '{{exterior_prompt}}',
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S11_TILE_3D_MODELS',
        order_index: 110,
        kind: 'model3d',
        provider: 'meshy',
        model_id: 'meshy-4',
        prompt_template: '{{tile_visual_prompt}} <GEOMETRY_REF:{{tile_geometry_role}}>',
        provider_config_json: {
            "quality_mode": "low_poly",
            "target_triangles": 7000,
            "texture_mode": "non_pbr_ok"
        },
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S12_PROP_3D_MODELS',
        order_index: 120,
        kind: 'model3d',
        provider: 'rodin',
        model_id: '',
        prompt_template: '{{prop_visual_prompt}}',
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S13_BOSS_3D_MODEL',
        order_index: 130,
        kind: 'model3d',
        provider: 'rodin',
        model_id: '',
        prompt_template: '{{boss_visual_prompt}}',
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S14_NORMALIZE_ALL_MODELS',
        order_index: 140,
        kind: 'code',
        provider: 'internal',
        prompt_template: '',
        breakpoint_after: false
    },
    {
        flow_version_id: '',
        stage_key: 'S15_BUILD_MANIFEST',
        order_index: 150,
        kind: 'code',
        provider: 'internal',
        prompt_template: '',
        breakpoint_after: true
    }
];

export async function seedDefaults() {
    console.log("🌱 [Seed] Checking seed data...");

    // 1. Check/Seed Default Flow
    const flows = await FlowsDb.listFlows();
    let defaultFlow = flows.find(f => f.name === 'bossroom_default' && f.version_major === 0 && f.version_minor === 1 && f.version_patch === 0);

    if (!defaultFlow) {
        console.log("🌱 [Seed] Creating 'bossroom_default' v0.1.0...");
        try {
            defaultFlow = await FlowsDb.createFlow({
                name: 'bossroom_default',
                version_major: 0,
                version_minor: 1,
                version_patch: 0,
                description: 'Default Boss Room generation flow (Semi-automated)'
            });
            await FlowsDb.publishFlow(defaultFlow.id);
        } catch (e) {
            console.error("❌ [Seed] Failed to create default flow:", e);
            return;
        }
    } else {
        console.log("🌱 [Seed] 'bossroom_default' exists.");
    }

    // 2. Check/Seed Default Stages
    if (defaultFlow) {
        const currentStages = await FlowsDb.listStages(defaultFlow.id);

        // Cleanup: Identify stages that are NOT in our new list (e.g. from previous skeleton seed)
        const newKeys = new Set(DEFAULT_STAGES.map(s => s.stage_key));
        const stagesToDelete = currentStages.filter(s => !newKeys.has(s.stage_key));

        if (stagesToDelete.length > 0) {
            console.log(`🌱 [Seed] Cleaning up ${stagesToDelete.length} obsolete stages...`);
            const client = await FlowsDb.getClient();
            try {
                // Determine IDs to delete
                const idsToDelete = stagesToDelete.map(s => s.id);
                // Use ANY($1) syntax for array
                await client.query(`DELETE FROM flow_stage_templates WHERE id = ANY($1::uuid[])`, [idsToDelete]);
            } catch (e) {
                console.warn("⚠️ [Seed] Failed to cleanup obsolete stages:", e);
            } finally {
                await client.end();
            }
        }

        // Upsert all default stages
        for (const stageParams of DEFAULT_STAGES) {
            stageParams.flow_version_id = defaultFlow.id;
            try {
                // Upsert handles insert or update
                await FlowsDb.upsertStage(stageParams);
            } catch (e) {
                console.error(`❌ [Seed] Failed to upsert stage ${stageParams.stage_key}:`, e);
            }
        }
        console.log("🌱 [Seed] Default stages verified/seeded.");
    }
}
