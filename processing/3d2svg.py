import bpy
import math
import os
from mathutils import Vector

# Configuration
model_path = "/Users/mattfranchi/Repos/space-stager/processing/models/linknyc-081825.blend"  # Optional: .blend to open or ignore if already open
output_dir = "/Users/mattfranchi/Repos/space-stager/processing/svg_outputs"
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
    # Attempt to open model .blend if provided and different from current
    try:
        if model_path and os.path.isfile(model_path):
            # Only open if current file path differs to avoid reloading
            current_filepath = bpy.data.filepath
            if not current_filepath or os.path.abspath(current_filepath) != os.path.abspath(model_path):
                bpy.ops.wm.open_mainfile(filepath=model_path)
    except Exception:
        # Non-fatal; continue with current scene
        pass

    # Always use the current active scene after potential file load
    scene = bpy.context.scene
    if not scene:
        return

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
        scene.view_settings.view_transform = 'Filmic'
        scene.view_settings.look = 'None'
        scene.view_settings.exposure = 0.0
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
        bg = nodes.get("Background") or nodes.new("ShaderNodeBackground")
        out = nodes.get("World Output") or nodes.new("ShaderNodeOutputWorld")
        bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
        bg.inputs[1].default_value = 1.5
        # Ensure links
        has_link = any(l.to_node == out and l.from_node == bg for l in links)
        if not has_link:
            links.new(bg.outputs[0], out.inputs[0])
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
        ensure_sun("IsoSunKey", (math.radians(50), 0.0, math.radians(45)), 3.0, (1.0, 0.98, 0.95))
        # Fill
        ensure_sun("IsoSunFill", (math.radians(70), 0.0, math.radians(180+30)), 0.9, (0.9, 0.95, 1.0))
        # Rim
        ensure_sun("IsoSunRim", (math.radians(40), 0.0, math.radians(-60)), 0.7, (0.95, 0.97, 1.0))
        # AO and shadows
        if hasattr(scene, 'eevee'):
            try:
                scene.eevee.use_gtao = True
                scene.eevee.gtao_distance = 0.8
                scene.eevee.gtao_factor = 1.0
                scene.eevee.use_shadows = True
            except Exception:
                pass
    except Exception:
        pass

    # Utility: set camera to look at target with world up
    def set_camera_look_at(cam_obj, cam_loc: Vector, target: Vector, world_up: Vector = Vector((0, 0, 1))):
        """Aim camera with a stable roll relative to world_up to avoid tilt at 0/90/180/270."""
        cam_obj.location = cam_loc
        import mathutils
        forward = (target - cam_loc)
        if forward.length == 0:
            forward = Vector((0.0, 0.0, -1.0))
        forward.normalize()
        # If nearly parallel, choose an alternate up
        if abs(forward.dot(world_up)) > 0.999:
            world_up = Vector((0.0, 1.0, 0.0))
        right = world_up.cross(forward)
        if right.length == 0:
            right = Vector((1.0, 0.0, 0.0))
        right.normalize()
        true_up = forward.cross(right)
        true_up.normalize()
        rot = mathutils.Matrix((
            (right.x,  true_up.x, -forward.x),
            (right.y,  true_up.y, -forward.y),
            (right.z,  true_up.z, -forward.z),
        ))
        cam_obj.rotation_euler = rot.to_euler()

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
        if not math.isfinite(width_needed) or width_needed <= 0:
            return
        cam_obj.data.ortho_scale = max(width_needed, 0.1)

    # Ensure Line Art GP object exists and is configured only if SVG requested
    gp = None
    if output_format in ("SVG", "BOTH"):
        gp = ensure_lineart_gp_object("LineArt", cam)

    # Precompute constants for isometric camera placement
    elev_rad = math.radians(isometric_elevation_deg)
    base_yaw_rad = math.radians(base_yaw_offset_deg)
    radius = max_size * 2.0 + 1.0

    # Render/Export for each yaw angle
    # Precompute trig with snapping to stabilize cardinal views
    def snap_trig(val: float) -> float:
        v = round(val, 10)
        # Snap tiny to 0, near +/-1 to exact
        if abs(v) < 1e-10:
            return 0.0
        if abs(1.0 - abs(v)) < 1e-10:
            return 1.0 if v > 0 else -1.0
        return v

    cos_elev = snap_trig(math.cos(elev_rad))
    sin_elev = snap_trig(math.sin(elev_rad))

    for angle in angles:
        yaw_rad = math.radians(angle) + base_yaw_rad
        cos_yaw = snap_trig(math.cos(yaw_rad))
        sin_yaw = snap_trig(math.sin(yaw_rad))
        # Camera position on a circle around Z with fixed elevation
        x = center.x + radius * cos_yaw * cos_elev
        y = center.y + radius * sin_yaw * cos_elev
        z = center.z + radius * sin_elev
        cam_loc = Vector((x, y, z))
        set_camera_look_at(cam, cam_loc, center, world_up=Vector((0, 0, 1)))
        # Fit ortho scale precisely against current camera orientation
        fit_ortho_scale_to_bounds(cam, get_world_corners(mesh_objects), margin=1.15)
        bpy.context.view_layer.update()

        # SVG export path (optional)
        if output_format in ("SVG", "BOTH") and gp is not None:
            bake_lineart_if_available(gp)
            svg_path = os.path.join(output_dir, f"view_{angle:03d}.svg")
            export_gp_to_svg(svg_path)

        # PNG export path (default)
        if output_format in ("PNG", "BOTH"):
            scene.render.image_settings.file_format = 'PNG'
            scene.render.image_settings.color_mode = 'RGBA'
            scene.render.filepath = os.path.join(output_dir, f"view_{angle:03d}.png")
            bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
