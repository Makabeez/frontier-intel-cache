import { useState, useCallback } from "react";
import { copyToClipboard } from "../lib/util";

/**
 * <CopyHash value={fullHash} display={shortHash} title={"tx digest"} />
 *
 * Renders the (possibly shortened) hash. Click → copies the FULL value.
 * Shows a tiny "✓ copied" hint for 1.4s.
 */
export default function CopyHash({ value, display, title, href, className = "" }) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(
    async (e) => {
      // If there's an href and user is using a modifier or middle-click, let it through
      if (href && (e.metaKey || e.ctrlKey || e.button === 1)) return;
      e.preventDefault();
      const ok = await copyToClipboard(value);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }
    },
    [value, href],
  );

  const Tag = href ? "a" : "button";
  const extraProps = href ? { href, target: "_blank", rel: "noopener noreferrer" } : { type: "button" };

  return (
    <span className="inline-flex items-baseline gap-1.5 align-baseline">
      <Tag
        {...extraProps}
        onClick={handleClick}
        title={title ? `${title} — click to copy, ${href ? "⌘+click to open" : ""}` : "click to copy"}
        className={`hash ${className}`}
      >
        {display || value}
      </Tag>
      {copied && (
        <span className="text-ok text-[10px] uppercase tracking-[0.15em]">
          ✓ copied
        </span>
      )}
    </span>
  );
}
