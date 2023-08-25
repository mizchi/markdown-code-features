import { useEffect, useRef } from "react";

export function Preview(props: {
  code: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (ref.current) {
      const encoded = btoa(unescape(encodeURIComponent(props.code)));
      const blob = new Blob(
        [
          `<!DOCTYPE html>
<html>
  <head>
  </head>
  <body>
  <script type=module>
    import("data:text/javascript;base64,${encoded}").then(mod => {
      if (mod.default && typeof mod.default === "function") {
        mod.default();
      }
    });
  </script>
  </body>
</html>`,
        ],
        { type: "text/html" },
      );
      ref.current.src = URL.createObjectURL(blob);
    }
  }, [ref.current, props.code]);
  return (
    <iframe
      ref={ref}
      title="preview"
      sandbox="allow-scripts"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
}
