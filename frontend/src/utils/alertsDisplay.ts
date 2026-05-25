import type { Alert, Bin } from '../api';
import type { LiveReading } from '../context/LiveDataContext';

export const GAS_LIMIT_PPM = 300;

export type IssueSeverity = 'ok' | 'warning' | 'critical';

export interface BinStatusIssue {
  kind: 'fill' | 'gas' | 'ok';
  severity: IssueSeverity;
  title: string;
  detail: string;
}

export function liveIssuesForBin(bin: Bin, live?: LiveReading): BinStatusIssue[] {
  const fill = live?.fill ?? 0;
  const gas = live?.gas ?? 0;
  const issues: BinStatusIssue[] = [];

  if (fill >= bin.threshold_pct) {
    issues.push({
      kind: 'fill',
      severity: 'critical',
      title: 'Bin nearly full',
      detail: `${fill.toFixed(0)}% filled — empty this bin soon (limit ${bin.threshold_pct}%)`,
    });
  } else if (fill >= 50) {
    issues.push({
      kind: 'fill',
      severity: 'warning',
      title: 'Bin filling up',
      detail: `${fill.toFixed(0)}% filled — plan a pickup soon`,
    });
  }

  if (gas >= GAS_LIMIT_PPM) {
    issues.push({
      kind: 'gas',
      severity: 'critical',
      title: 'Strong odor detected',
      detail: `Gas sensor at ${gas.toFixed(0)} ppm (safe below ${GAS_LIMIT_PPM} ppm) — fan is on`,
    });
  }

  if (issues.length === 0) {
    issues.push({
      kind: 'ok',
      severity: 'ok',
      title: 'All normal',
      detail: live
        ? `Fill ${fill.toFixed(0)}%, gas ${gas.toFixed(0)} ppm — no action needed`
        : 'Waiting for sensor data from simulation',
    });
  }

  return issues;
}

export function friendlyAlert(alert: Alert, bin?: Bin): { title: string; detail: string; icon: string } {
  const name = alert.bin_name || bin?.name || 'Bin';

  if (alert.type === 'threshold_exceeded') {
    const nums = alert.message.match(/\d+/g)?.map(Number) ?? [];
    const fill = nums[0];
    const limit = nums[1] ?? bin?.threshold_pct ?? 80;
    if (alert.resolved) {
      return {
        icon: '✓',
        title: `${name} — fill level OK`,
        detail: fill != null ? `Back to ${fill}% (under ${limit}% limit)` : 'Bin is no longer over capacity',
      };
    }
    return {
      icon: '🗑️',
      title: `${name} — nearly full`,
      detail: fill != null ? `${fill}% filled (limit ${limit}%)` : 'Capacity limit reached',
    };
  }

  if (alert.type === 'gas_detected') {
    const nums = alert.message.match(/\d+/g)?.map(Number) ?? [];
    const gas = nums[0];
    if (alert.resolved) {
      return {
        icon: '✓',
        title: `${name} — air quality OK`,
        detail: gas != null ? `Gas down to ${gas} ppm` : 'Odor level returned to normal',
      };
    }
    return {
      icon: '💨',
      title: `${name} — high odor`,
      detail: gas != null ? `Gas at ${gas} ppm (limit ${GAS_LIMIT_PPM} ppm)` : 'Gas sensor above safe level',
    };
  }

  return {
    icon: '⚠️',
    title: name,
    detail: alert.message,
  };
}

export function alertTypeShort(type: string): string {
  if (type === 'threshold_exceeded') return 'Capacity';
  if (type === 'gas_detected') return 'Odor / gas';
  return type;
}
