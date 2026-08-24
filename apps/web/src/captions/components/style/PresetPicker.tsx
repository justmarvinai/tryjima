import { useAppStore } from '../../state/store';
import { CAPTION_PRESETS, matchingPresetId, type CaptionPreset } from '@jima/captions/captions';
import { FONTS } from '@jima/captions/fonts';

/**
 * One-click caption looks. Applying a preset replaces the whole style; any
 * manual tweak afterwards simply deselects the preset (the controls below
 * always reflect the live style).
 */
export function PresetPicker() {
  const style = useAppStore((s) => s.style);
  const setStyle = useAppStore((s) => s.setStyle);
  const activeId = matchingPresetId(style);

  return (
    <div className="grid grid-cols-2 gap-2">
      {CAPTION_PRESETS.map((preset) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          active={preset.id === activeId}
          onApply={() => setStyle({ ...preset.style })}
        />
      ))}
    </div>
  );
}

function PresetCard({
  preset,
  active,
  onApply,
}: {
  preset: CaptionPreset;
  active: boolean;
  onApply: () => void;
}) {
  const { style } = preset;
  const font = FONTS[style.fontFamily];
  const strokePx = style.strokeWidthPct > 0 ? Math.max(1, (style.strokeWidthPct / 100) * 18) : 0;

  return (
    <button
      type="button"
      onClick={onApply}
      aria-pressed={active}
      className={[
        'group rounded-2xl border-2 p-1.5 text-left transition-all duration-200 ease-out-soft',
        active
          ? 'border-lime bg-lime-tint/60 shadow-xs'
          : 'border-transparent bg-surface-2/60 hover:border-line hover:bg-surface-2',
      ].join(' ')}
    >
      {/* mini "video" swatch */}
      <div
        className="flex h-14 items-center justify-center overflow-hidden rounded-xl"
        style={{
          backgroundImage:
            'radial-gradient(120% 120% at 25% 10%, #6b7280 0%, #374151 55%, #111827 100%)',
        }}
      >
        <span
          className={style.backgroundEnabled ? 'rounded-md px-1.5 py-0.5' : ''}
          style={{
            fontFamily: font ? `"${font.family}", sans-serif` : 'sans-serif',
            fontWeight: font?.weight ?? 700,
            fontSize: 17,
            lineHeight: 1,
            color: style.textColor,
            WebkitTextStroke: strokePx > 0 ? `${strokePx}px ${style.strokeColor}` : undefined,
            paintOrder: 'stroke fill',
            backgroundColor: style.backgroundEnabled ? 'rgba(0,0,0,0.55)' : undefined,
          }}
        >
          {style.uppercase ? 'AA' : 'Aa'}
          <span
            style={
              style.highlightStyle === 'box'
                ? {
                    backgroundColor: style.highlightColor,
                    color: style.textColor,
                    borderRadius: 4,
                    padding: '1px 3px',
                    marginLeft: 2,
                    WebkitTextStroke: undefined,
                  }
                : {
                    color: style.highlightColor,
                    WebkitTextStroke: strokePx > 0 ? `${strokePx}px ${style.strokeColor}` : undefined,
                  }
            }
          >
            {style.uppercase ? 'A' : 'a'}
          </span>
        </span>
      </div>
      <p className={`mt-1.5 px-0.5 text-[12.5px] font-semibold ${active ? 'text-lime' : 'text-chalk'}`}>
        {preset.name}
      </p>
      <p className="px-0.5 pb-0.5 text-[10.5px] leading-tight text-dim">{preset.tagline}</p>
    </button>
  );
}
