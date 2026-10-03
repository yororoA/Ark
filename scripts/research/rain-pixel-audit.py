"""Reproducible native-pixel audit of the supplied MV, with no temporal sampling.

Dependencies: numpy, opencv-python-headless, av, Pillow.
Example:
  python rain-pixel-audit.py scan INPUT.mp4 OUTPUT
  python rain-pixel-audit.py inspect INPUT.mp4 OUTPUT 690 1159 1294

Contact sheets are deliberately reduced for visual navigation. All measurements
and PNG inspection exports use decoded source pixels, never sheet pixels.
Optical flow is an estimate, not proof of object identity or true layer motion.
"""
import argparse
import csv
import hashlib
import json
import time
from pathlib import Path

import av
import cv2
import numpy as np
from PIL import Image, ImageDraw

cv2.setNumThreads(4)


def digest(file):
    with file.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def percentile_from_hist(histogram, fraction):
    return int(np.searchsorted(np.cumsum(histogram), histogram.sum() * fraction))


def tile_means(array, rows=6, columns=8):
    height, width = array.shape[:2]
    return np.asarray([
        array[y * height // rows:(y + 1) * height // rows,
              x * width // columns:(x + 1) * width // columns].mean(axis=(0, 1))
        for y in range(rows) for x in range(columns)
    ]).round(3).tolist()


def scan(video, output, limit):
    output.mkdir(parents=True, exist_ok=True)
    (output / "sheets").mkdir(exist_ok=True)
    container = av.open(str(video))
    stream = container.streams.video[0]
    width, height = stream.width, stream.height
    frame_pixels = width * height
    metadata = {
        "source": str(video), "source_sha256": digest(video),
        "width": width, "height": height, "format": stream.codec_context.format.name,
        "codec": stream.codec_context.name, "time_base": str(stream.time_base),
        "average_rate": str(stream.average_rate),
        "container_frame_count": stream.frames,
        "analysis_resolution": [width, height], "spatial_downsampling": False,
        "temporal_sampling": False, "rgb_conversion": "PyAV/FFmpeg rgb24",
        "flow": "OpenCV DIS ultrafast, finest scale 0; estimated, invalid across cut candidates",
        "pixel_change_threshold": "max absolute RGB channel difference > 8",
        "cut_candidate_rule": "mean absolute RGB delta > 18 and changed fraction > .45",
        "cyan_mask_rule": "OpenCV HSV H 75..110, S 35..255, V 40..255",
        "edge_rule": "Canny grayscale 60/160, L2gradient=True",
        "visual_sheets": "Every consecutive frame, 60 per sheet; thumbnails 320x180, not pixel evidence",
        "versions": {"av": av.__version__, "cv2": cv2.__version__, "numpy": np.__version__},
        "complete": False,
    }
    (output / "manifest.json").write_text(json.dumps(metadata, indent=2))
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_ULTRAFAST)
    dis.setFinestScale(0)
    previous_rgb = previous_gray = None
    total_difference = np.zeros((height, width), np.float64)
    total_edges = np.zeros((height, width), np.float64)
    rgb_histograms, gray_histograms, row_profiles, column_profiles = [], [], [], []
    coverage = []
    cuts, rows = [], []
    start = time.monotonic()
    sheet = None
    count = 0
    with (output / "frames.jsonl").open("w") as detail, (output / "frames.csv").open("w", newline="") as table:
        fields = ["frame", "pts", "seconds", "sha256", "mean_r", "mean_g", "mean_b",
                  "gray_p10", "gray_p50", "gray_p90", "cyan_fraction", "edge_fraction",
                  "rgb_mae", "changed_pixels_gt8", "changed_fraction_gt8",
                  "flow_mean_x", "flow_mean_y", "flow_speed_p90", "cut_candidate"]
        writer = csv.DictWriter(table, fields)
        writer.writeheader()
        for index, frame in enumerate(container.decode(stream)):
            if limit and index >= limit:
                break
            rgb = frame.to_ndarray(format="rgb24")
            assert rgb.shape == (height, width, 3), "Source resolution changed"
            gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
            hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
            cyan = cv2.inRange(hsv, (75, 35, 40), (110, 255, 255))
            edges = cv2.Canny(gray, 60, 160, L2gradient=True)
            histogram = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel().astype(np.uint32)
            channels = np.stack([cv2.calcHist([rgb], [channel], None, [256], [0, 256]).ravel() for channel in range(3)]).astype(np.uint32)
            assert all(channel.sum() == frame_pixels for channel in channels)
            assert histogram.sum() == frame_pixels
            rgb_histograms.append(channels)
            gray_histograms.append(histogram)
            row_profiles.append((edges > 0).sum(axis=1).astype(np.uint16))
            column_profiles.append((edges > 0).sum(axis=0).astype(np.uint16))
            total_edges += edges / 255
            average = rgb.mean(axis=(0, 1))
            row = dict(frame=index, pts=frame.pts, seconds=round(float(frame.time), 6),
                       sha256=hashlib.sha256(rgb.tobytes()).hexdigest(),
                       mean_r=round(float(average[0]), 4), mean_g=round(float(average[1]), 4),
                       mean_b=round(float(average[2]), 4),
                       gray_p10=percentile_from_hist(histogram, .1),
                       gray_p50=percentile_from_hist(histogram, .5),
                       gray_p90=percentile_from_hist(histogram, .9),
                       cyan_fraction=round(float(np.count_nonzero(cyan) / frame_pixels), 6),
                       edge_fraction=round(float(np.count_nonzero(edges) / frame_pixels), 6),
                       rgb_mae=0., changed_pixels_gt8=0, changed_fraction_gt8=0.,
                       flow_mean_x=None, flow_mean_y=None, flow_speed_p90=None,
                       cut_candidate=False)
            extra = {"tile_rgb": tile_means(rgb)}
            moments = cv2.moments(cyan, binaryImage=True)
            extra["cyan_centroid"] = [round(moments["m10"] / moments["m00"], 3), round(moments["m01"] / moments["m00"], 3)] if moments["m00"] else None
            if previous_rgb is not None:
                delta = cv2.absdiff(rgb, previous_rgb)
                maximum = delta.max(axis=2)
                changed = (maximum > 8).astype(np.uint8)
                row["rgb_mae"] = round(float(delta.mean()), 5)
                row["changed_pixels_gt8"] = int(changed.sum())
                row["changed_fraction_gt8"] = round(row["changed_pixels_gt8"] / frame_pixels, 6)
                row["cut_candidate"] = row["rgb_mae"] > 18 and row["changed_fraction_gt8"] > .45
                extra["change_bbox"] = list(cv2.boundingRect(changed)) if changed.any() else None
                extra["tile_delta"] = tile_means(delta)
                total_difference += maximum
                if row["cut_candidate"]:
                    cuts.append({"frame": index, "seconds": row["seconds"], "rgb_mae": row["rgb_mae"]})
                else:
                    flow = dis.calc(previous_gray, gray, None)
                    assert flow.shape == (height, width, 2)
                    speed = cv2.magnitude(flow[..., 0], flow[..., 1])
                    row["flow_mean_x"], row["flow_mean_y"] = [round(float(value), 4) for value in flow.mean(axis=(0, 1))]
                    row["flow_speed_p90"] = round(float(np.quantile(speed, .9)), 4)
                    extra["tile_flow"] = tile_means(flow)
            detail.write(json.dumps({**row, **extra}, separators=(",", ":")) + "\n")
            writer.writerow(row)
            rows.append(row)
            if index % 60 == 0:
                sheet = Image.new("RGB", (1920, 2000), "#e8eeee")
                sheet_draw = ImageDraw.Draw(sheet)
            slot = index % 60
            x, y = slot % 6 * 320, slot // 6 * 200
            thumbnail = Image.fromarray(rgb).resize((320, 180), Image.Resampling.LANCZOS)
            sheet.paste(thumbnail, (x, y))
            sheet_draw.text((x + 4, y + 183), f"#{index:05d}  {row['seconds']:.6f}s", fill="#16383e")
            if slot == 59:
                name = f"{index // 60:03d}-{index - 59:05d}-{index:05d}.jpg"
                sheet.save(output / "sheets" / name, quality=92)
                coverage.append({"file": name, "first": index - 59, "last": index, "viewed": False})
            previous_rgb, previous_gray = rgb, gray
            count = index + 1
            if count % 120 == 0:
                detail.flush()
                table.flush()
                print(f"{count} frames / {row['seconds']:.2f}s source; {time.monotonic() - start:.1f}s processing", flush=True)
        if count % 60:
            last = count - 1
            name = f"{last // 60:03d}-{last - last % 60:05d}-{last:05d}.jpg"
            sheet.save(output / "sheets" / name, quality=92)
            coverage.append({"file": name, "first": last - last % 60, "last": last, "viewed": False})
    container.close()
    np.savez_compressed(output / "pixel-profiles.npz", rgb_histograms=np.array(rgb_histograms),
                        gray_histograms=np.array(gray_histograms), edge_rows=np.array(row_profiles),
                        edge_columns=np.array(column_profiles))
    cv2.imwrite(str(output / "edge-occupancy.png"), (total_edges / count * 255).astype(np.uint8))
    heat = np.clip(total_difference / max(count - 1, 1) * 5, 0, 255).astype(np.uint8)
    cv2.imwrite(str(output / "temporal-difference.png"), cv2.applyColorMap(heat, cv2.COLORMAP_TURBO))
    metadata.update(decoded_frames=count, pixels_measured=count * frame_pixels,
                    rgb_samples_measured=count * frame_pixels * 3,
                    adjacent_pairs=max(count - 1, 0),
                    first_pts=rows[0]["pts"], last_pts=rows[-1]["pts"],
                    last_seconds=rows[-1]["seconds"], cut_candidates=len(cuts),
                    complete=count == metadata["container_frame_count"],
                    elapsed_seconds=round(time.monotonic() - start, 2))
    (output / "manifest.json").write_text(json.dumps(metadata, indent=2))
    (output / "cut-candidates.json").write_text(json.dumps(cuts, indent=2))
    (output / "visual-coverage.json").write_text(json.dumps(coverage, indent=2))
    assert [row["frame"] for row in rows] == list(range(count))
    assert all(rows[index]["pts"] > rows[index - 1]["pts"] for index in range(1, count))
    print(f"Complete: {count} frames; {metadata['pixels_measured']:,} native pixels; {len(coverage)} consecutive sheets", flush=True)


def inspect(video, output, frames):
    output.mkdir(parents=True, exist_ok=True)
    wanted = set(frames)
    found = []
    with av.open(str(video)) as container:
        for index, frame in enumerate(container.decode(video=0)):
            if index in wanted:
                rgb = frame.to_ndarray(format="rgb24")
                Image.fromarray(rgb).save(output / f"frame-{index:05d}.png")
                found.append({"frame": index, "pts": frame.pts, "seconds": float(frame.time),
                              "width": frame.width, "height": frame.height,
                              "sha256": hashlib.sha256(rgb.tobytes()).hexdigest()})
            if index >= max(wanted):
                break
    assert len(found) == len(wanted), "Requested frames outside the video"
    (output / "inspected-frames.json").write_text(json.dumps(found, indent=2))
    print(f"Exported {len(found)} source-sized lossless PNGs")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["scan", "inspect"])
    parser.add_argument("video", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("frames", nargs="*", type=int)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    if args.mode == "scan":
        scan(args.video, args.output, args.limit)
    else:
        inspect(args.video, args.output, args.frames)
