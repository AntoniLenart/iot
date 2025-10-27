import { useEffect, useRef } from "react";

export default function FloorPlan({ hrFree, mainFree, svgMarkup }) {
  const wrapperRef = useRef(null);

  useEffect(() => {
    const svg = wrapperRef.current?.querySelector("svg");
    if (!svg) return;
    

    const updateRoom = (roomId, isFree) => {
      const room = svg.querySelector(`#${roomId}`);
      if (!room) return;

      const fillColor = isFree
        ? "rgba(16, 185, 129, 0.45)"
        : "rgba(239, 68, 68, 0.45)"

      room.style.fill = fillColor;
      room.style.opacity = 1;
      room.style.fillOpacity = 1;

      svg.appendChild(room); // na wierzch
    };

    updateRoom("HR", hrFree);
    updateRoom("Main", mainFree);

  }, [hrFree, mainFree, svgMarkup]);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full max-h-[400px] flex justify-center items-center overflow-auto bg-white"
    >
      {svgMarkup && (
        <div
          className="flex justify-center items-center origin-center scale-[0.4]"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      )}
    </div>
  );
}
