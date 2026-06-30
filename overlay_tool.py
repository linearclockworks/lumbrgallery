import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider
from PIL import Image
import requests
from io import BytesIO
import ezdxf

# Load your data ecosystems
with open('lumber.json', 'r') as f:
    lumber_data = json.load(f)
with open('photo_ids.json', 'r') as f:
    photo_ids = json.load(f)

def extract_dxf_points(dxf_path):
    """Extracts lines, polylines, and circles from Layer_1 of the DXF file."""
    try:
        doc = ezdxf.readfile(dxf_path)
    except IOError:
        print(f"Error: Cannot find or read DXF file at {dxf_path}")
        return []
    except ezdxf.DXFStructureError:
        print(f"Error: Invalid DXF structure in {dxf_path}")
        return []

    msp = doc.modelspace()
    paths = []
    
    # Filter for entities on Layer_1
    layer_entities = msp.query('*[layer=="Layer_1"]')
    
    for entity in layer_entities:
        if entity.dxftype() == 'POLYLINE':
            points = [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]
            if entity.is_closed:
                points.append(points[0])
            paths.append(np.array(points))
        elif entity.dxftype() == 'LINE':
            points = [(entity.dxf.start.x, entity.dxf.start.y), (entity.dxf.end.x, entity.dxf.end.y)]
            paths.append(np.array(points))
        elif entity.dxftype() == 'CIRCLE':
            # Approximate circle with points for quick vector plotting
            cx, cy = entity.dxf.center.x, entity.dxf.center.y
            r = entity.dxf.radius
            angles = np.linspace(0, 2*np.pi, 50)
            points = [(cx + r*np.cos(a), cy + r*np.sin(a)) for a in angles]
            paths.append(np.array(points))
            
    return paths

def load_lumber_image(url):
    """Downloads the Google Drive preview image safely into memory."""
    try:
        response = requests.get(url, timeout=10)
        img = Image.open(BytesIO(response.content))
        return img
    except Exception as e:
        print(f"Could not load image from link: {e}")
        return None

def launch_overlay_session(serial_number, dxf_file):
    # 1. Fetch data profiles
    item_info = lumber_data.get(serial_number, {})
    img_url = photo_ids.get(serial_number)
    
    if not img_url:
        print(f"No photo link found for serial {serial_number}")
        return
        
    print(f"Loading Session -> Serial: {serial_number} | Owner: {item_info.get('owner')} | Location: {item_info.get('location')}")
    
    img = load_lumber_image(img_url)
    if img is None:
        return
        
    raw_paths = extract_dxf_points(dxf_file)
    if not raw_paths:
        print("No design vectors extracted. Verify DXF path and layers.")
        return

    # Normalize vectors roughly to center around (0,0) for predictable rotation
    all_pts = np.vstack([p for p in raw_paths])
    center_x, center_y = np.mean(all_pts, axis=0)
    normalized_paths = [p - [center_x, center_y] for p in raw_paths]

    # 2. Setup Plot Window
    fig, ax = plt.subplots(figsize=(10, 6))
    plt.subplots_adjust(bottom=0.35)
    
    ax.imshow(img)
    ax.set_title(f"Lumber {serial_number} - Owner: {item_info.get('owner')} | Location: {item_info.get('location')}")
    
    # Store cross-session rendering references
    lines = []
    for path in normalized_paths:
        line, = ax.plot([], [], color='cyan', alpha=0.7, lw=1.5) # Semitransparent cyan overlay
        lines.append((line, path))

    # 3. Create Fine-tuning Sliders
    ax_x = plt.axes([0.15, 0.24, 0.7, 0.03])
    ax_y = plt.axes([0.15, 0.19, 0.7, 0.03])
    ax_scale = plt.axes([0.15, 0.14, 0.7, 0.03])
    ax_rot = plt.axes([0.15, 0.09, 0.7, 0.03])

    img_w, img_h = img.size
    s_x = Slider(ax_x, 'X Pos', 0, img_w, valinit=img_w/2)
    s_y = Slider(ax_y, 'Y Pos', 0, img_h, valinit=img_h/2)
    s_scale = Slider(ax_scale, 'Scale', 0.01, 10.0, valinit=1.0)
    s_rot = Slider(ax_rot, 'Twist (°)', 0, 360, valinit=0)

    def update(val):
        cx = s_x.val
        cy = s_y.val
        scale = s_scale.val
        theta = np.radians(s_rot.val)
        
        # Matrix rotation asset transformations
        cos_t, sin_t = np.cos(theta), np.sin(theta)
        R = np.array([[cos_t, -sin_t], [sin_t, cos_t]])
        
        for line, path in lines:
            # Transform vectors: Scale -> Rotate -> Shift coordinates
            transformed = (path * scale) @ R.T + [cx, cy]
            line.set_data(transformed[:, 0], transformed[:, 1])
            
        fig.canvas.draw_idle()

    s_x.on_changed(update)
    s_y.on_changed(update)
    s_scale.on_changed(update)
    s_rot.on_changed(update)

    # Initialize frame render layout
    update(None)
    plt.show()

# --- RUN EXECUTION ---
if __name__ == '__main__':
    # Test session configuration using metadata from your logs
    target_serial = "1050" 
    dxf_blueprint = "3ft-devangari-15min-CNC-inches.dxf" # Or change to your 5ft script file
    
    launch_overlay_session(target_serial, dxf_blueprint)