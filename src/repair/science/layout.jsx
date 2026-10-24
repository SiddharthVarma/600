import { LabLayout, Status, ViewSwitch } from '../shared/layout.jsx';

// A science request in the shared lab layout: its title, brief, guide and why it was asked for, from its SCIENCE entry.
export function ScienceLayout({ info, ...rest }) {
  return (
    <LabLayout
      eyebrow="Hosted payload request"
      title={info.title}
      signal={info.signal}
      signalColor="var(--blue)"
      brief={info.brief}
      guide={info.guide}
      about={info.about}
      aboutLabel="About this request"
      cite={info.cite}
      facts={info.facts}
      {...rest}
    />
  );
}

// the result, in the toolbar: green for a full haul, amber for anything less
export const ScienceResult = ({ ok, children }) => <Status tone={ok ? 'ok' : 'partial'}>{children}</Status>;

export { ViewSwitch };
