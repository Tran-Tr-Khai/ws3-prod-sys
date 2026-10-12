import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './MachineOverviewCard.css';

export type OverviewTone = 'normal' | 'muted' | 'success' | 'warning' | 'alarm' | 'info';

export type OverviewField = {
  key: string;
  label: string;
  value: string | number | null | undefined;
  tone?: OverviewTone;
  fullWidth?: boolean;
};

export type OverviewMessage = { text: string; tone?: OverviewTone };

export type MachineOverviewSummary = {
  operation: OverviewField[];
  production: OverviewField[];
  statuses?: OverviewField[];
  operationMessage?: OverviewMessage;
  productionMessage?: OverviewMessage;
};

type MachineOverviewCardProps = {
  name: string;
  machineId: string;
  available: boolean;
  selector?: ReactNode;
  operationLabel: string;
  productionLabel: string;
  summary: MachineOverviewSummary;
  href: string;
  actionLabel: string;
};

function OverviewFields({ fields }: { fields: OverviewField[] }) {
  if (!fields.length) return null;
  return <dl className="machine-overview__fields">
    {fields.map((field) => <div key={field.key} className={`machine-overview__field${field.fullWidth ? ' machine-overview__field--wide' : ''}`}>
      <dt className="machine-overview__label">{field.label}</dt>
      <dd className="machine-overview__value" data-tone={field.tone ?? 'normal'}>{field.value === '' || field.value == null ? '—' : field.value}</dd>
    </div>)}
  </dl>;
}

function OverviewMessageText({ message }: { message?: OverviewMessage }) {
  return message ? <p role="status" className="machine-overview__message" data-tone={message.tone ?? 'muted'}>{message.text}</p> : null;
}

/** All machines share the card, field markup and typography; only their data varies. */
export function MachineOverviewCard({ name, machineId, available, selector, operationLabel, productionLabel, summary, href, actionLabel }: MachineOverviewCardProps) {
  return <article className="machine-overview" data-available={available}>
    <header className="machine-overview__header">
      <h2 className="machine-overview__title">{name}</h2>
      {selector ?? <span className="machine-overview__code">{machineId}</span>}
    </header>
    <div className="machine-overview__body">
      <section className="machine-overview__section">
        <h3 className="machine-overview__section-title">{operationLabel}</h3>
        <OverviewFields fields={summary.operation} />
        <OverviewMessageText message={summary.operationMessage} />
      </section>
      <section className="machine-overview__section">
        <h3 className="machine-overview__section-title">{productionLabel}</h3>
        <OverviewFields fields={summary.production} />
        <OverviewMessageText message={summary.productionMessage} />
        {!!summary.statuses?.length && <div className="machine-overview__statuses"><OverviewFields fields={summary.statuses} /></div>}
      </section>
    </div>
    <footer className="machine-overview__footer"><Link to={href} className="machine-overview__action">{actionLabel}</Link></footer>
  </article>;
}
