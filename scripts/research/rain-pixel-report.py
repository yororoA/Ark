"""Summarize the native-pixel MV audit and inspect representative geometry."""
import argparse
import csv
import json
from pathlib import Path

import av
import cv2
import numpy as np
from PIL import Image


def ranges(values):
    result = []
    if not values:
        return result
    first = previous = values[0]
    for value in values[1:]:
        if value != previous + 1:
            result.append([first, previous])
            first = value
        previous = value
    result.append([first, previous])
    return result


def histogram_percentile(histogram, fraction):
    return int(np.searchsorted(np.cumsum(histogram), histogram.sum() * fraction))


def color(value):
    return f"#{value[0]:02x}{value[1]:02x}{value[2]:02x}"


def dominant_colors(image, count=12):
    # Median-cut considers every source pixel, then returns measured occupancy.
    source = Image.fromarray(image)
    quantized = source.quantize(colors=count, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()
    histogram = quantized.getcolors(source.width * source.height)
    total = source.width * source.height
    result = []
    for pixels, index in sorted(histogram, reverse=True):
        rgb = tuple(palette[index * 3:index * 3 + 3])
        result.append({"hex": color(rgb), "rgb": rgb, "pixels": pixels,
                       "fraction": round(pixels / total, 6)})
    return result


def long_lines(image):
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 45, 120, L2gradient=True)
    segments = cv2.HoughLinesP(edges, 1, np.pi / 180, 170,
                               minLineLength=min(image.shape[:2]) * .4,
                               maxLineGap=12)
    result = []
    if segments is not None:
        for segment in segments.reshape(-1, 4):
            x1, y1, x2, y2 = map(int, segment)
            length = round(float(np.hypot(x2 - x1, y2 - y1)), 2)
            angle = round(float(np.degrees(np.arctan2(y2 - y1, x2 - x1))), 2)
            result.append({"points": [x1, y1, x2, y2], "length": length, "angle": angle})
    return sorted(result, key=lambda item: item["length"], reverse=True)[:24]


def analyze(video, audit, output, representatives):
    with (audit / "frames.csv").open() as file:
        rows = list(csv.DictReader(file))
    manifest = json.loads((audit / "manifest.json").read_text())
    profiles = np.load(audit / "pixel-profiles.npz")
    frame_numbers = [int(row["frame"]) for row in rows]
    assert manifest["complete"] and frame_numbers == list(range(manifest["decoded_frames"]))
    assert manifest["pixels_measured"] == manifest["decoded_frames"] * manifest["width"] * manifest["height"]
    numeric = {}
    for field in ["gray_p10", "gray_p50", "gray_p90", "cyan_fraction", "edge_fraction",
                  "rgb_mae", "changed_fraction_gt8", "flow_speed_p90"]:
        values = np.array([float(row[field]) for row in rows if row[field] not in ("", "None")])
        numeric[field] = {
            "minimum": round(float(values.min()), 6),
            "p10": round(float(np.quantile(values, .1)), 6),
            "median": round(float(np.median(values)), 6),
            "p90": round(float(np.quantile(values, .9)), 6),
            "p99": round(float(np.quantile(values, .99)), 6),
            "maximum": round(float(values.max()), 6),
        }
    white = [int(row["frame"]) for row in rows if float(row["gray_p10"]) >= 238]
    dark = [int(row["frame"]) for row in rows if float(row["gray_p90"]) <= 70]
    still = [int(row["frame"]) for row in rows[1:] if float(row["changed_fraction_gt8"]) <= .01]
    cuts = sorted((row for row in rows if row["cut_candidate"] == "True"),
                  key=lambda row: float(row["rgb_mae"]), reverse=True)
    channel_histograms = profiles["rgb_histograms"].sum(axis=0)
    channel_names = ["red", "green", "blue"]
    global_channels = {}
    for name, histogram in zip(channel_names, channel_histograms):
        values = np.arange(256)
        global_channels[name] = {
            "mean": round(float((histogram * values).sum() / histogram.sum()), 4),
            "mode": int(histogram.argmax()),
            "p10": histogram_percentile(histogram, .1),
            "median": histogram_percentile(histogram, .5),
            "p90": histogram_percentile(histogram, .9),
        }
    edge_rows = profiles["edge_rows"].sum(axis=0)
    edge_columns = profiles["edge_columns"].sum(axis=0)
    persistent_rows = sorted(range(len(edge_rows)), key=lambda index: edge_rows[index], reverse=True)[:20]
    persistent_columns = sorted(range(len(edge_columns)), key=lambda index: edge_columns[index], reverse=True)[:20]
    decoded = {}
    wanted = set(representatives)
    with av.open(str(video)) as container:
        for index, frame in enumerate(container.decode(video=0)):
            if index in wanted:
                rgb = frame.to_ndarray(format="rgb24")
                decoded[index] = {
                    "frame": index, "pts": frame.pts, "seconds": round(float(frame.time), 6),
                    "dominant_colors": dominant_colors(rgb), "long_lines": long_lines(rgb),
                }
            if index >= max(wanted):
                break
    report = {
        "integrity": {
            "source_sha256": manifest["source_sha256"],
            "decoded_frames": manifest["decoded_frames"],
            "analysis_resolution": manifest["analysis_resolution"],
            "spatial_downsampling": manifest["spatial_downsampling"],
            "temporal_sampling": manifest["temporal_sampling"],
            "pixels_measured": manifest["pixels_measured"],
            "rgb_samples_measured": manifest["rgb_samples_measured"],
            "first_pts": manifest["first_pts"], "last_pts": manifest["last_pts"],
            "last_seconds": manifest["last_seconds"],
        },
        "distributions": numeric,
        "global_source_channels": global_channels,
        "persistent_edge_rows": [{"y": int(index), "edge_pixels": int(edge_rows[index])} for index in persistent_rows],
        "persistent_edge_columns": [{"x": int(index), "edge_pixels": int(edge_columns[index])} for index in persistent_columns],
        "near_white_ranges": ranges(white),
        "near_dark_ranges": ranges(dark),
        "low_change_ranges": ranges(still),
        "cut_candidates": {
            "count": len(cuts),
            "strongest_40": [{
                "frame": int(row["frame"]), "seconds": float(row["seconds"]),
                "rgb_mae": float(row["rgb_mae"]),
                "changed_fraction": float(row["changed_fraction_gt8"]),
            } for row in cuts[:40]],
        },
        "representatives": [decoded[index] for index in representatives],
        "notes": [
            "White/dark/still ranges are threshold-based evidence, not semantic scene labels.",
            "Dominant colors use median-cut over every source pixel of each representative frame.",
            "Hough line positions are detector estimates; verify source PNG before applying exact geometry.",
        ],
    }
    output.write_text(json.dumps(report, indent=2))
    print(json.dumps({
        "frames": report["integrity"]["decoded_frames"],
        "pixels": report["integrity"]["pixels_measured"],
        "cut_candidates": report["cut_candidates"]["count"],
        "white_ranges": len(report["near_white_ranges"]),
        "dark_ranges": len(report["near_dark_ranges"]),
        "representatives": len(report["representatives"]),
    }, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video", type=Path)
    parser.add_argument("audit", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--frames", nargs="+", type=int, required=True)
    args = parser.parse_args()
    analyze(args.video, args.audit, args.output, args.frames)
