import { useEffect, useRef } from "react";

export default function FloorPlan({ svgMarkup, onIdsDetected, hoveredRoomId, roomStatus }) {
  const wrapperRef = useRef(null);

  useEffect(() => {
    const svg = wrapperRef.current?.querySelector("svg");
    if (!svg) return;

    // Apply responsive scaling styles for the inserted SVG
    svg.style.maxWidth = "100%";
    svg.style.maxHeight = "100%";
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.objectFit = "contain";
    svg.style.display = "block";

    const svgWidth = parseFloat(svg.getAttribute("width") || 0);
    const svgHeight = parseFloat(svg.getAttribute("height") || 0);

    let elements = [...svg.querySelectorAll("path[id], rect[id]")];

    elements = elements.filter(el => {
      if (!el.id) return false;

      if (el.tagName === "rect") {
        const w = parseFloat(el.getAttribute("width") || 0);
        const h = parseFloat(el.getAttribute("height") || 0);

        const isBackground =
          w >= svgWidth * 0.8 &&
          h >= svgHeight * 0.8;

        if (isBackground) return false;
      }

      return true;
    });

const ids = elements.map(el => el.id);

onIdsDetected?.(ids);

  }, [svgMarkup]);

  useEffect(() => {
    const svg = wrapperRef.current?.querySelector("svg");
    if (!svg) return;

    const paths = svg.querySelectorAll("path[id], rect[id]");

    paths.forEach((p) => {
      p.style.outline = "none";
      p.style.stroke = "";
      p.style.strokeWidth = "";
      p.style.fill = "";
      p.style.fillOpacity = "";
    });

    // Apply room reservation coloring
    Object.entries(roomStatus || {}).forEach(([key, isFree]) => {
      const pureId = key.split(":")[1] || key;

      const el = svg.querySelector(`#${CSS.escape(pureId)}`);
      if (!el) return;

      el.style.fill = isFree
        ? "rgba(16,185,129,0.45)"
        : "rgba(239,68,68,0.45)";
      el.style.fillOpacity = "1";
    });

    // Apply hover highlight
    if (hoveredRoomId) {
      const el = svg.querySelector(`#${CSS.escape(hoveredRoomId)}`);
      if (el) {
        el.style.stroke = "#2563eb";
        el.style.strokeWidth = "6px";
        el.style.fill = "rgba(37, 99, 235, 0.35)";
        el.style.fillOpacity = "1";
      }
    }
  }, [roomStatus, hoveredRoomId, svgMarkup]);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full flex justify-center items-center overflow-hidden bg-white"
    >
      {svgMarkup && (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      )}
    </div>
  );
}
