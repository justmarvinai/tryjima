import type { ReactNode } from 'react';
import { useAppStore } from '../../state/store';
import { ColorField, Segmented, Select, Slider, Toggle } from '@/ui';
import { PresetPicker } from './PresetPicker';
import { STYLE_RANGES, type CaptionAnimation } from '@jima/captions/captions';
import { CAPTION_FONTS } from '@jima/captions/fonts';

const fontOptions = CAPTION_FONTS.map((f) => ({ value: f.key, label: f.label }));

const ANIMATION_OPTIONS: { value: CaptionAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'pop', label: 'Pop' },
  { value: 'swing', label: 'Swing' },
];

/** Right-panel caption styling controls, grouped Font / Colors / Background / Layout. */
export function StylePanel() {
  const style = useAppStore((s) => s.style);
  const setStyle = useAppStore((s) => s.setStyle);
  const resetStyle = useAppStore((s) => s.resetStyle);
  const hasCaptions = useAppStore((s) => s.transcription.cues.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-[13px] font-semibold text-chalk">Style</p>
        <button
          type="button"
          onClick={resetStyle}
          className="rounded-full px-2.5 py-1 text-xs font-medium text-dim transition-colors hover:bg-surface-2 hover:text-chalk"
        >
          Reset
        </button>
      </div>

      <div className="panel-scroll min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {!hasCaptions && (
          <p className="text-sm leading-relaxed text-dim">
            Generate captions to preview them. You can still set up the look here.
          </p>
        )}

        <Group title="Presets">
          <PresetPicker />
        </Group>

        <Group title="Font">
          <Select
            label="Typeface"
            value={style.fontFamily}
            options={fontOptions}
            onChange={(v) => setStyle({ fontFamily: v })}
          />
          <Slider
            label="Size"
            value={style.fontSizePct}
            {...STYLE_RANGES.fontSizePct}
            onChange={(v) => setStyle({ fontSizePct: v })}
            format={(v) => `${v}%`}
          />
          <Toggle label="Uppercase" checked={style.uppercase} onChange={(v) => setStyle({ uppercase: v })} />
        </Group>

        <Group title="Colors">
          <ColorField label="Text" value={style.textColor} onChange={(v) => setStyle({ textColor: v })} />
          <ColorField label="Outline" value={style.strokeColor} onChange={(v) => setStyle({ strokeColor: v })} />
          <Slider
            label="Outline width"
            value={style.strokeWidthPct}
            {...STYLE_RANGES.strokeWidthPct}
            onChange={(v) => setStyle({ strokeWidthPct: v })}
          />
          <Toggle
            label="Highlight spoken word"
            checked={style.highlightEnabled}
            onChange={(v) => setStyle({ highlightEnabled: v })}
          />
          {style.highlightEnabled && (
            <>
              <Segmented
                label="Highlight style"
                value={style.highlightStyle}
                options={[
                  { value: 'color', label: 'Color' },
                  { value: 'box', label: 'Box' },
                ]}
                onChange={(v) => setStyle({ highlightStyle: v })}
              />
              <ColorField
                label="Highlight"
                value={style.highlightColor}
                onChange={(v) => setStyle({ highlightColor: v })}
              />
            </>
          )}
        </Group>

        <Group title="Background">
          <Toggle
            label="Background pill"
            checked={style.backgroundEnabled}
            onChange={(v) => setStyle({ backgroundEnabled: v })}
          />
          {style.backgroundEnabled && (
            <>
              <ColorField
                label="Color"
                value={style.backgroundColor}
                onChange={(v) => setStyle({ backgroundColor: v })}
              />
              <Slider
                label="Opacity"
                value={style.backgroundOpacity}
                {...STYLE_RANGES.backgroundOpacity}
                onChange={(v) => setStyle({ backgroundOpacity: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <Slider
                label="Roundness"
                value={style.backgroundRadiusPct}
                {...STYLE_RANGES.backgroundRadiusPct}
                onChange={(v) => setStyle({ backgroundRadiusPct: v })}
              />
            </>
          )}
        </Group>

        <Group title="Motion">
          <Segmented
            label="Animation"
            value={style.animation}
            options={ANIMATION_OPTIONS}
            onChange={(v) => setStyle({ animation: v })}
          />
        </Group>

        <Group title="Layout">
          <Segmented
            label="Lines"
            value={String(style.maxLines) as '1' | '2'}
            options={[
              { value: '1', label: '1 line' },
              { value: '2', label: '2 lines' },
            ]}
            onChange={(v) => setStyle({ maxLines: v === '1' ? 1 : 2 })}
          />
          <Slider
            label="Vertical position"
            value={style.positionYPct}
            {...STYLE_RANGES.positionYPct}
            onChange={(v) => setStyle({ positionYPct: v })}
            format={(v) => `${v}%`}
          />
          <Slider
            label="Max width"
            value={style.maxWidthPct}
            {...STYLE_RANGES.maxWidthPct}
            onChange={(v) => setStyle({ maxWidthPct: v })}
            format={(v) => `${v}%`}
          />
        </Group>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2/60 p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-dim">{title}</p>
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}
