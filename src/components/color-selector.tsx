const inkColors = ['#ced4da', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];
const fillColors = ['#ffffff', ...inkColors.slice(1)];

export function ColorSelector({ label, value, onChange, disabled = false, fill = false }: {
  label: string; value: string; onChange: (color: string) => void; disabled?: boolean; fill?: boolean;
}) {
  return <div className="color-selector" role="group" aria-label={label}>
    <div className="color-presets">{(fill ? fillColors : inkColors).map(color => <button key={color} type="button" className="color-swatch" style={{ backgroundColor: color }} aria-label={`${label} ${color}`} aria-pressed={value.toLowerCase() === color} title={color} disabled={disabled} onClick={() => onChange(color)}/>)}</div>
    <div className="color-custom"><input type="color" disabled={disabled} aria-label={label} title={disabled ? 'Controlled by code' : `Custom color: ${value}`} value={value} onChange={event => onChange(event.target.value)}/></div>
  </div>;
}
