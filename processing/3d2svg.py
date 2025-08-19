import bpy
import math
import os
from mathutils import Vector

# Configuration
model_path = "/Users/mattfranchi/Repos/space-stager/processing/models/linknyc-081825.blend"  # Optional: .blend to open or ignore if already open
output_dir = "/Users/mattfranchi/Repos/space-stager/processing/svg_outputs"
angles = [0, 45, 90, 135, 180, 225, 270, 315]  # in degrees around Z (yaw)

# Ensure output folder exists
os.makedirs(output_dir, exist_ok=True)


def get_main_mesh_objects():
    """Return a list of visible mesh objects likely representing the model."""
    mesh_objects = []
    scn = bpy.context.scene
    if not scn:
        return mesh_objects
    for obj in scn.objects:
        try:
            if obj.type == 'MESH' and obj.visible_get():
                mesh_objects.append(obj)
        except ReferenceError:
            # Object or scene may have been reloaded; skip
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
        bpy.ops.object.gpencil_add(type='EMPTY', location=(0, 0, 0))
        gp_obj = bpy.context.object
        gp_obj.name = name
    # Make active to add modifiers via operator
    bpy.context.view_layer.objects.active = gp_obj
    # Ensure a Line Art modifier exists
    def find_lineart_mod(obj):
        mods = getattr(obj, 'grease_pencil_modifiers', None) or getattr(obj, 'modifiers', [])
        for m in mods:
            if m.type == 'GP_LINEART':
                return m
        return None
    lineart = find_lineart_mod(gp_obj)
    if not lineart:
        try:
            bpy.ops.object.gpencil_modifier_add(type='GP_LINEART')
        except Exception:
            pass
        lineart = find_lineart_mod(gp_obj)
    # Configure camera if property exists
    if lineart and hasattr(lineart, 'source_type'):
        try:
            lineart.source_type = 'SCENE'
        except Exception:
            pass
        # Target camera if supported
        if hasattr(lineart, 'source_camera'):
            try:
                lineart.source_camera = target_camera
            except Exception:
                pass
        # Common visibility settings
        for attr, val in (
            ('use_crease', True),
            ('use_intersection', True),
            ('use_crease', True),
            ('use_material', True),
            ('use_contour', True),
            ('use_crease', True),
        ):
            if hasattr(lineart, attr):
                try:
                    setattr(lineart, attr, val)
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
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.use_freestyle = False  # We will use Grease Pencil Line Art for SVG export

    mesh_objects = get_main_mesh_objects()
    center, size_x, size_y = compute_world_bounds_center_and_size(mesh_objects)

    orbit = ensure_orbit_empty("OrbitRoot", center)
    cam = ensure_camera("BatchCam", scene)
    scene.camera = cam

    # Orthographic camera framing
    cam.data.type = 'ORTHO'
    max_size = max(2.0, max(size_x, size_y))
    cam.data.ortho_scale = max_size * 1.15
    cam.data.clip_start = 0.01
    cam.data.clip_end = 1000.0

    # Place camera at a reasonable radius and height relative to scale
    radius = max_size * 0.75 + 0.5
    height = max_size * 0.25
    cam.location = (radius, 0.0, height)
    # Parent to orbit so rotating orbit spins camera around center
    cam.parent = orbit
    # Ensure camera always looks at orbit center
    point_camera_with_constraint(cam, orbit)

    # Ensure Line Art GP object exists and is configured
    gp = ensure_lineart_gp_object("LineArt", cam)

    # Render/Export for each yaw angle
    for angle in angles:
        rad = math.radians(angle)
        orbit.rotation_euler = (0.0, 0.0, rad)
        bpy.context.view_layer.update()

        # Bake Line Art if operators are available; otherwise rely on live generation
        bake_lineart_if_available(gp)

        svg_path = os.path.join(output_dir, f"view_{angle:03d}.svg")
        export_gp_to_svg(svg_path)


if __name__ == "__main__":
    main()
