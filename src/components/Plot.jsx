import { useEffect, useRef } from "react";
// Official partial bundle (bar, heatmap, scatter, …): ~25% of the full plotly.js size.
import Plotly from "plotly.js-cartesian-dist-min";
import { PLOT_CONFIG } from "../lib/theme.js";

/**
 * Thin Plotly wrapper: re-renders in place with Plotly.react, follows its
 * container's size, and purges on unmount. `onClick` receives the first
 * clicked point.
 */
export default function Plot({ data, layout, height = 420, config, onClick, label }) {
  const ref = useRef(null);
  const clickRef = useRef(onClick);
  const boundRef = useRef(false);
  clickRef.current = onClick;

  useEffect(() => {
    const node = ref.current;
    Plotly.react(node, data, { ...layout, height }, { ...PLOT_CONFIG, ...config }).then(() => {
      if (!boundRef.current) {
        node.on("plotly_click", (event) => clickRef.current?.(event.points?.[0]));
        boundRef.current = true;
      }
    });
  }, [data, layout, height, config]);

  useEffect(() => {
    const node = ref.current;
    // Window-resize handling alone misses layout changes (e.g. the side panel wrapping).
    const observer = new ResizeObserver(() => {
      if (node.data) Plotly.Plots.resize(node);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      Plotly.purge(node);
    };
  }, []);

  return <div ref={ref} className="plot" style={{ height }} role="img" aria-label={label} />;
}
