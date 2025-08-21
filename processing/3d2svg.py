import bpy
import math
import os
import glob
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
import sys 

# Configuration
output_dir = "/Users/mattfranchi/Repos/space-stager/processing/outputs"
# Directory containing .blend models to process
models_dir = "/Users/mattfranchi/Repos/space-stager/processing/models"
# Eight isometric yaws at 45° increments (including 0°)
angles = [0, 45, 90, 135, 180, 225, 270, 315]  # in degrees around Z (yaw)

# Output configuration
# options: 'PNG', 'SVG', 'BOTH'
output_format = os.environ.get("SS_OUTPUT_FORMAT", "PNG").upper()
output_resolution = int(os.environ.get("SS_OUTPUT_RES", "512"))
isometric_elevation_deg = float(os.environ.get("SS_ISO_ELEV_DEG", "35.264"))
base_yaw_offset_deg = float(os.environ.get("SS_BASE_YAW_DEG", "0"))
engine_choice = os.environ.get("SS_ENGINE", "EEVEE").upper()  # EEVEE|CYCLES
film_transparent = os.environ.get("SS_FILM_TRANSPARENT", "1") not in ("0", "false", "False")
debug_overlay = os.environ.get("SS_DEBUG_OVERLAY", "0") in ("1", "true", "True")
env_hdri_path = os.environ.get("SS_ENV_HDRI", "")
# Add top-down view export option
export_top_down = os.environ.get("SS_EXPORT_TOP_DOWN", "1") in ("1", "true", "True")

# Ensure output folder exists
os.makedirs(output_dir, exist_ok=True)


def get_main_mesh_objects():
    """Return a list of mesh objects in the file (ignore visibility flags)."""
    mesh_objects = []
    for obj in bpy.data.objects:
        try:
            if obj.type == 'MESH':
                mesh_objects.append(obj)
        except ReferenceError:
            continue
    return mesh_objects


def get_model_stem(model_path_arg=None):
    """Derive a stable filename stem from the provided model path or current .blend."""
    try:
        if model_path_arg and os.path.isfile(model_path_arg):
            return os.path.splitext(os.path.basename(model_path_arg))[0]
    except Exception:
        pass
    try:
        if bpy.data.filepath:
            return os.path.splitext(os.path.basename(bpy.data.filepath))[0]
    except Exception:
        pass
    return "model"


def compute_world_bounds_center_and_size(objects):
    """Compute world-space AABB center and XY size for given objects."""
    if not objects:
        return Vector((0.0, 0.0, 0.0)), 2.0, 2.0
    mins = Vector((float('inf'), float('inf'), float('inf')))
    maxs = Vector((float('-inf'), float('-inf'), float('-inf')))
    for obj in objects:
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ Vector(corner)
            mins.x = min(mins.x, world_corner.x)
            mins.y = min(mins.y, world_corner.y)
            mins.z = min(mins.z, world_corner.z)
            maxs.x = max(maxs.x, world_corner.x)
            maxs.y = max(maxs.y, world_corner.y)
            maxs.z = max(maxs.z, world_corner.z)
    center = (mins + maxs) * 0.5
    size_x = maxs.x - mins.x
    size_y = maxs.y - mins.y
    return center, size_x, size_y


def get_world_corners(objects):
    corners = []
    for obj in objects:
        try:
            for c in obj.bound_box:
                corners.append(obj.matrix_world @ Vector(c))
        except Exception:
            pass
    return corners


def ensure_orbit_empty(name: str, location: Vector):
    obj = bpy.data.objects.get(name)
    if obj and obj.type == 'EMPTY':
        obj.location = location
        return obj
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=location)
    empty = bpy.context.object
    empty.name = name
    return empty


def ensure_camera(name: str, scene):
    cam_obj = bpy.data.objects.get(name)
    if cam_obj and cam_obj.type == 'CAMERA':
        return cam_obj
    cam_data = bpy.data.cameras.new(name)
    cam_obj = bpy.data.objects.new(name, cam_data)
    scene.collection.objects.link(cam_obj)
    return cam_obj


def point_camera_with_constraint(camera_obj, target_obj):
    # Clear previous tracking constraints
    for c in list(camera_obj.constraints):
        camera_obj.constraints.remove(c)
    # Damped Track to look at target
    damp = camera_obj.constraints.new('DAMPED_TRACK')
    damp.target = target_obj
    damp.track_axis = 'TRACK_NEGATIVE_Z'
    # Keep camera up pointing to world Y
    locked = camera_obj.constraints.new('LOCKED_TRACK')
    locked.target = target_obj
    locked.track_axis = 'TRACK_NEGATIVE_Z'
    locked.lock_axis = 'LOCK_Y'


def ensure_lineart_gp_object(name: str, target_camera):
    gp_obj = bpy.data.objects.get(name)
    if not gp_obj or gp_obj.type != 'GPENCIL':
        # Prefer the new Grease Pencil add operator in Blender 4.x
        try:
            bpy.ops.object.grease_pencil_add(type='LINEART_SCENE', use_in_front=True, location=(0, 0, 0))
        except Exception:
            # Fallback: create an EMPTY GP object
            bpy.ops.object.grease_pencil_add(type='EMPTY', use_in_front=True, location=(0, 0, 0))
        gp_obj = bpy.context.object
        gp_obj.name = name

    # Make active to add/find modifiers via operators
    bpy.context.view_layer.objects.active = gp_obj

    # Helper to find an existing Line Art modifier across API variants
    def find_lineart_mod(obj):
        mods = getattr(obj, 'grease_pencil_modifiers', None) or getattr(obj, 'modifiers', [])
        for m in mods:
            mtype = getattr(m, 'type', '')
            clsname = m.__class__.__name__
            if mtype in ('GP_LINEART', 'GREASE_PENCIL_LINEART') or 'Lineart' in clsname or 'LineArt' in clsname:
                return m
        return None

    lineart = find_lineart_mod(gp_obj)
    if not lineart:
        # Try operator to add a GP Line Art modifier
        try:
            if hasattr(bpy.ops.object, 'grease_pencil_modifier_add'):
                bpy.ops.object.grease_pencil_modifier_add(type='LINEART')
        except Exception:
            pass
        lineart = find_lineart_mod(gp_obj)
        if not lineart:
            # Try standard modifier API as a last resort
            try:
                mods_api = getattr(gp_obj, 'grease_pencil_modifiers', None)
                if mods_api and hasattr(mods_api, 'new'):
                    lineart = mods_api.new(name='Line Art', type='GREASE_PENCIL_LINEART')
                else:
                    lineart = gp_obj.modifiers.new(name='Line Art', type='GREASE_PENCIL_LINEART')
            except Exception:
                lineart = None

    # Configure camera and common Line Art options if properties exist
    if lineart:
        for attr, val in (
            ('source_type', 'SCENE'),
            ('use_contour', True),
            ('use_intersection', True),
            ('use_material', True),
            ('use_crease', True),
            ('use_image_boundary_trimming', True),
        ):
            if hasattr(lineart, attr):
                try:
                    setattr(lineart, attr, val)
                except Exception:
                    pass
        if hasattr(lineart, 'source_camera'):
            try:
                lineart.source_camera = target_camera
            except Exception:
                pass

    return gp_obj


def bake_lineart_if_available(gp_obj):
    bpy.context.view_layer.objects.active = gp_obj
    try:
        # Clear previous bakes if operator exists
        if hasattr(bpy.ops.object, 'lineart_clear'):
            bpy.ops.object.lineart_clear()
    except Exception:
        pass
    try:
        if hasattr(bpy.ops.object, 'lineart_bake_strokes'):
            bpy.ops.object.lineart_bake_strokes()
    except Exception:
        pass


def export_gp_to_svg(filepath: str):
    # Export visible GP objects clipped to camera view
    bpy.ops.wm.grease_pencil_export_svg(
        filepath=filepath,
        use_fill=False,
        selected_object_type='VISIBLE',
        frame_mode='ACTIVE',
        use_clip_camera=True,
        check_existing=False,
    )


def main():
    # Collect all .blend files to process
    blend_files = sorted([p for p in glob.glob(os.path.join(models_dir, "*.blend")) if os.path.isfile(p)])

    for model_path in blend_files:
        # Attempt to open model .blend
        try:
            if model_path and os.path.isfile(model_path):
                current_filepath = bpy.data.filepath
                if not current_filepath or os.path.abspath(current_filepath) != os.path.abspath(model_path):
                    bpy.ops.wm.open_mainfile(filepath=model_path)
        except Exception:
            pass

        # Always use the current active scene after potential file load
        scene = bpy.context.scene
        if not scene:
            continue

        # Scene setup
        # Render engine selection
        if engine_choice == 'CYCLES':
            scene.render.engine = 'CYCLES'
            try:
                scene.cycles.device = 'CPU'
                scene.cycles.samples = 32
            except Exception:
                pass
        else:
            scene.render.engine = 'BLENDER_EEVEE_NEXT'
        scene.render.use_freestyle = False  # Avoid Freestyle; prefer raster or GP Line Art only if explicitly requested

        # High-quality orthographic render defaults (for PNG path)
        scene.render.resolution_x = output_resolution
        scene.render.resolution_y = output_resolution
        scene.render.resolution_percentage = 100
        # Transparent background so non-model pixels are fully transparent
        scene.render.film_transparent = True
        try:
            # Punchier highlights and sun: Filmic with high contrast
            scene.view_settings.view_transform = 'Filmic'
            scene.view_settings.look = 'Very High Contrast'
            scene.view_settings.exposure = 0.6
            scene.view_settings.gamma = 1.0
            scene.display_settings.display_device = 'sRGB'
        except Exception:
            pass

        mesh_objects = get_main_mesh_objects()
        center, size_x, size_y = compute_world_bounds_center_and_size(mesh_objects)

        # Ensure all collections are enabled in the active view layer and renderable
        def enable_all_layer_collections(layer_collection):
            try:
                layer_collection.exclude = False
                if hasattr(layer_collection, 'hide_viewport'):
                    layer_collection.hide_viewport = False
            except Exception:
                pass
            for child in getattr(layer_collection, 'children', []):
                enable_all_layer_collections(child)

        try:
            enable_all_layer_collections(bpy.context.view_layer.layer_collection)
        except Exception:
            pass

        # Also mark object and collection render flags on
        try:
            for obj in bpy.data.objects:
                try:
                    obj.hide_render = False
                    if hasattr(obj, 'visible_get') and not obj.visible_get():
                        obj.hide_set(False)
                except Exception:
                    pass
            for coll in bpy.data.collections:
                try:
                    coll.hide_render = False
                except Exception:
                    pass
        except Exception:
            pass

        cam = ensure_camera("BatchCam", scene)
        scene.camera = cam

        # Orthographic camera framing
        cam.data.type = 'ORTHO'
        max_size = max(2.0, max(size_x, size_y))
        cam.data.ortho_scale = max_size * 1.25
        cam.data.clip_start = 0.01
        cam.data.clip_end = 5000.0

        # Improve lighting: world and a simple 3-sun rig
        try:
            world = scene.world or bpy.data.worlds.new("World")
            scene.world = world
            world.use_nodes = True
            nodes = world.node_tree.nodes
            links = world.node_tree.links
            # Clear and rebuild world tree for clean setup
            for n in list(nodes):
                nodes.remove(n)
            out = nodes.new("ShaderNodeOutputWorld")
            bg = nodes.new("ShaderNodeBackground")
            if env_hdri_path and os.path.isfile(env_hdri_path):
                env = nodes.new("ShaderNodeTexEnvironment")
                try:
                    env.image = bpy.data.images.load(env_hdri_path)
                except Exception:
                    env = None
                if env:
                    links.new(env.outputs['Color'], bg.inputs['Color'])
            # Strength: balanced to avoid darkness while keeping transparent film
            bg.inputs[1].default_value = 1.0
            links.new(bg.outputs['Background'], out.inputs['Surface'])
        except Exception:
            pass

        # Optional debug overlay: bright emissive axis cross at center
        if debug_overlay:
            try:
                mat = bpy.data.materials.get("SS_Debug_Emissive") or bpy.data.materials.new("SS_Debug_Emissive")
                mat.use_nodes = True
                nt = mat.node_tree
                for n in list(nt.nodes):
                    nt.nodes.remove(n)
                out = nt.nodes.new("ShaderNodeOutputMaterial")
                emit = nt.nodes.new("ShaderNodeEmission")
                emit.inputs[0].default_value = (1.0, 0.2, 0.2, 1.0)
                emit.inputs[1].default_value = 5.0
                nt.links.new(emit.outputs[0], out.inputs[0])
                for axis, color in (('X', (1, 0.2, 0.2, 1)), ('Y', (0.2, 1, 0.2, 1)), ('Z', (0.2, 0.2, 1, 1))):
                    mesh = bpy.data.meshes.new(f"SS_Debug_{axis}")
                    obj = bpy.data.objects.new(f"SS_Debug_{axis}", mesh)
                    bpy.context.scene.collection.objects.link(obj)
                    verts = [
                        (center.x - 0.5, center.y, center.z),
                        (center.x + 0.5, center.y, center.z),
                    ] if axis == 'X' else [
                        (center.x, center.y - 0.5, center.z),
                        (center.x, center.y + 0.5, center.z),
                    ] if axis == 'Y' else [
                        (center.x, center.y, center.z - 0.5),
                        (center.x, center.y, center.z + 0.5),
                    ]
                    edges = [(0, 1)]
                    mesh.from_pydata(verts, edges, [])
                    if obj.data.materials:
                        obj.data.materials[0] = mat
                    else:
                        obj.data.materials.append(mat)
                    obj.hide_render = False
            except Exception:
                pass

        def ensure_sun(name: str, rotation_euler, energy: float, color=(1.0, 1.0, 1.0)):
            light_obj = bpy.data.objects.get(name)
            if not light_obj or light_obj.type != 'LIGHT':
                light_data = bpy.data.lights.new(name=name, type='SUN')
                light_obj = bpy.data.objects.new(name, light_data)
                scene.collection.objects.link(light_obj)
            light_obj.rotation_euler = rotation_euler
            light_obj.data.energy = energy
            try:
                light_obj.data.color = color
            except Exception:
                pass
            return light_obj

        try:
            # Key light
            ensure_sun("IsoSunKey", (math.radians(50), 0.0, math.radians(45)), 5.0, (1.0, 0.98, 0.95))
            # Fill
            ensure_sun("IsoSunFill", (math.radians(70), 0.0, math.radians(180+30)), 1.2, (0.9, 0.95, 1.0))
            # Rim
            ensure_sun("IsoSunRim", (math.radians(40), 0.0, math.radians(-60)), 2.0, (0.95, 0.97, 1.0))
            # AO and shadows
            if hasattr(scene, 'eevee'):
                try:
                    scene.eevee.use_gtao = True
                    scene.eevee.gtao_distance = 0.8
                    scene.eevee.gtao_factor = 1.0
                    scene.eevee.use_shadows = True
                    # Reflections for metallic materials
                    if hasattr(scene.eevee, 'use_ssr'):
                        scene.eevee.use_ssr = True
                    if hasattr(scene.eevee, 'use_ssr_refraction'):
                        scene.eevee.use_ssr_refraction = True
                except Exception:
                    pass
        except Exception:
            pass

        # Utility: set camera to look at target with world up
        def set_camera_look_at(cam_obj, cam_loc: Vector, target: Vector, world_up: Vector = Vector((0, 0, 1))):
            """Aim camera using to_track_quat, then correct roll so image-plane up aligns with projected world_up.
            This stabilizes cardinal views without risking degenerate matrices.
            """
            import mathutils
            from mathutils import Quaternion
            cam_obj.location = cam_loc
            forward = (target - cam_loc)
            if forward.length == 0:
                forward = Vector((0.0, 0.0, -1.0))
            # Aim camera forward (-Z)
            rot_quat = forward.to_track_quat('-Z', 'Y')
            cam_obj.rotation_euler = rot_quat.to_euler()
            # Roll correction: align camera up (+Y) with world_up projected into image plane
            cam_quat = cam_obj.rotation_euler.to_quaternion()
            cam_forward_world = cam_quat @ Vector((0.0, 0.0, -1.0))
            cam_up_world = cam_quat @ Vector((0.0, 1.0, 0.0))
            up_proj = world_up - cam_forward_world * world_up.dot(cam_forward_world)
            if up_proj.length > 1e-8 and cam_up_world.length > 1e-8:
                up_proj.normalize()
                cam_up_world.normalize()
                # Signed angle around forward axis
                cross = cam_up_world.cross(up_proj)
                sign = 1.0 if cam_forward_world.dot(cross) > 0 else -1.0
                angle = cam_up_world.angle(up_proj)
                roll_delta = -sign * angle
                # Apply roll around camera forward axis (world space)
                roll_quat = Quaternion(cam_forward_world, roll_delta)
                cam_quat = roll_quat @ cam_quat
                cam_obj.rotation_euler = cam_quat.to_euler()

        def fit_ortho_scale_to_bounds(cam_obj, world_corners, margin: float = 1.1):
            """Fit orthographic width to contain all world corners with given margin.
            Accounts for render aspect ratio so both width and height fit.
            """
            if not world_corners:
                return
            inv = cam_obj.matrix_world.inverted()
            xs = []
            ys = []
            for wc in world_corners:
                lc = inv @ wc
                xs.append(lc.x)
                ys.append(lc.y)
            if not xs or not ys:
                return
            half_w = max(abs(min(xs)), abs(max(xs)))
            half_h = max(abs(min(ys)), abs(max(ys)))
            # Compute width needed so that height also fits given output aspect
            scn = bpy.context.scene
            aspect = (scn.render.resolution_x or 1) / max(1, scn.render.resolution_y)
            width_needed = max(2.0 * half_w, 2.0 * half_h * aspect)
            width_needed *= margin
            # Ensure at least a few pixels of border to avoid visible edge cropping
            border_px = int(os.environ.get("SS_BORDER_PX", "4"))
            if border_px > 0 and scn.render.resolution_x > 0:
                world_per_px = width_needed / scn.render.resolution_x
                width_needed += 2.0 * world_per_px * border_px
            if not math.isfinite(width_needed) or width_needed <= 0:
                return
            cam_obj.data.ortho_scale = max(width_needed, 0.1)

        def compute_needed_ortho_scale_for_current_pose(cam_obj, world_corners, scn, margin: float = 1.18, border_px: int = 4):
            """Compute required orthographic width for current camera pose to fit all points with margin.
            Returns the width needed (ortho_scale) without mutating the camera.
            """
            if not world_corners:
                return cam_obj.data.ortho_scale
            inv = cam_obj.matrix_world.inverted()
            xs = []
            ys = []
            for wc in world_corners:
                lc = inv @ wc
                xs.append(lc.x)
                ys.append(lc.y)
            if not xs or not ys:
                return cam_obj.data.ortho_scale
            half_w = max(abs(min(xs)), abs(max(xs)))
            half_h = max(abs(min(ys)), abs(max(ys)))
            aspect = (scn.render.resolution_x or 1) / max(1, scn.render.resolution_y)
            width_needed = max(2.0 * half_w, 2.0 * half_h * aspect)
            width_needed *= margin
            if border_px > 0 and scn.render.resolution_x > 0:
                world_per_px = width_needed / scn.render.resolution_x
                width_needed += 2.0 * world_per_px * border_px
            if not math.isfinite(width_needed) or width_needed <= 0:
                return cam_obj.data.ortho_scale
            return max(width_needed, 0.1)

        def fit_ortho_scale_by_ndc(scn, cam_obj, world_points, margin: float = 1.05):
            """Ensure no cropping by measuring object span in normalized device coords.
            If the projected span exceeds the frame (>=1.0), increase ortho_scale accordingly.
            """
            if not world_points:
                return
            # Compute normalized coordinates [0..1]
            min_x = 1.0
            min_y = 1.0
            max_x = 0.0
            max_y = 0.0
            for p in world_points:
                uvw = world_to_camera_view(scn, cam_obj, p)
                x, y = uvw.x, uvw.y
                # Clamp for safety
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if y < min_y:
                    min_y = y
                if y > max_y:
                    max_y = y
            span_x = max(1e-6, max_x - min_x)
            span_y = max(1e-6, max_y - min_y)
            span = max(span_x, span_y)
            if not math.isfinite(span):
                return
            if span * margin > 1.0:
                factor = span * margin
                cam_obj.data.ortho_scale = max(0.1, cam_obj.data.ortho_scale * factor)

        def render_top_down_view(cam_obj, angle_deg, model_stem, model_output_dir):
            """Render a top-down view from the given angle around the Z-axis."""
            yaw_rad = math.radians(angle_deg) + base_yaw_rad
            
            # Position camera directly above the center, looking straight down
            cam_obj.location = Vector((center.x, center.y, center.z + radius))
            
            # Rotate camera to look down at the target
            # Start with camera pointing down (-Z)
            cam_obj.rotation_euler = (0, 0, yaw_rad)
            
            # Then rotate around X to look down
            cam_obj.rotation_euler = (math.radians(90), 0, yaw_rad)
            
            bpy.context.view_layer.update()
            
            if output_format in ("PNG", "BOTH"):
                scene.render.image_settings.file_format = 'PNG'
                scene.render.image_settings.color_mode = 'RGBA'
                scene.render.filepath = os.path.join(model_output_dir, f"{model_stem}_TOP_{angle_deg:03d}.png")
                bpy.ops.render.render(write_still=True)

        # Ensure Line Art GP object exists and is configured only if SVG requested
        gp = None
        if output_format in ("SVG", "BOTH"):
            gp = ensure_lineart_gp_object("LineArt", cam)

        # Create model-specific output directory
        model_stem = get_model_stem(model_path)
        model_output_dir = os.path.join(output_dir, model_stem)
        os.makedirs(model_output_dir, exist_ok=True)

        # Precompute constants for isometric camera placement
        elev_rad = math.radians(isometric_elevation_deg)
        base_yaw_rad = math.radians(base_yaw_offset_deg)
        radius = max_size * 2.0 + 1.0

        # Two-pass fit: compute a single max ortho_scale that fits all angles, then render
        cos_elev = math.cos(elev_rad)
        sin_elev = math.sin(elev_rad)

        # Pass 1: compute max required scale across angles for isometric views
        max_required_scale = cam.data.ortho_scale
        for angle in angles:
            yaw_rad = math.radians(angle) + base_yaw_rad
            cos_yaw = math.cos(yaw_rad)
            sin_yaw = math.sin(yaw_rad)
            x = center.x + radius * cos_yaw * cos_elev
            y = center.y + radius * sin_yaw * cos_elev
            z = center.z + radius * sin_elev
            cam_loc = Vector((x, y, z))
            set_camera_look_at(cam, cam_loc, center, world_up=Vector((0, 0, 1)))
            angle_mod = int(angle) % 360
            is_diag = angle_mod in (45, 135, 225, 315)
            base_margin = 1.22 if is_diag else 1.18
            if angle_mod in (0, 360, 45):
                base_margin = max(base_margin, 1.30)
            req = compute_needed_ortho_scale_for_current_pose(cam, get_world_corners(mesh_objects), scene, margin=base_margin, border_px=int(os.environ.get("SS_BORDER_PX", "6")))
            if req > max_required_scale:
                max_required_scale = req

        cam.data.ortho_scale = max_required_scale

        # Pass 2: render isometric views with unified scale
        for angle in angles:
            yaw_rad = math.radians(angle) + base_yaw_rad
            cos_yaw = math.cos(yaw_rad)
            sin_yaw = math.sin(yaw_rad)
            x = center.x + radius * cos_yaw * cos_elev
            y = center.y + radius * sin_yaw * cos_elev
            z = center.z + radius * sin_elev
            cam_loc = Vector((x, y, z))
            set_camera_look_at(cam, cam_loc, center, world_up=Vector((0, 0, 1)))
            bpy.context.view_layer.update()

            if output_format in ("PNG", "BOTH"):
                scene.render.image_settings.file_format = 'PNG'
                scene.render.image_settings.color_mode = 'RGBA'
                scene.render.filepath = os.path.join(model_output_dir, f"{model_stem}_{angle:03d}.png")
                bpy.ops.render.render(write_still=True)

        # Render top-down views if enabled
        if export_top_down:
            # For top-down views, we need to adjust the ortho scale to fit the model from above
            # Reset camera to top-down position for scale calculation
            cam.location = Vector((center.x, center.y, center.z + radius))
            cam.rotation_euler = (math.radians(90), 0, 0)
            
            # Calculate appropriate ortho scale for top-down view
            world_corners = get_world_corners(mesh_objects)
            if world_corners:
                # Project corners to 2D (X,Y) plane for top-down view
                min_x = min_y = float('inf')
                max_x = max_y = float('-inf')
                for corner in world_corners:
                    min_x = min(min_x, corner.x)
                    max_x = max(max_x, corner.x)
                    min_y = min(min_y, corner.y)
                    max_y = max(max_y, corner.y)
                
                size_x = max_x - min_x
                size_y = max_y - min_y
                max_size_2d = max(size_x, size_y)
                
                # Set ortho scale with margin
                cam.data.ortho_scale = max_size_2d * 1.25
            
            # Render all 8 top-down rotated views
            for angle in angles:
                render_top_down_view(cam, angle, model_stem, model_output_dir)


if __name__ == "__main__":
    main()
