/* Product availability — ready to deliver vs made to order */
const AVAILABILITY_DEFAULT = 'mto';

const AVAILABILITY_META = {
  ready: {
    id: 'ready',
    label: 'Ready to Deliver',
    short: 'Ready',
    hint: 'In stock and available for dispatch. Enquire for same-day or scheduled delivery.',
    badgeClass: 'avail-ready',
  },
  mto: {
    id: 'mto',
    label: 'Made to Order',
    short: 'Made to Order',
    hint: 'Crafted on commission for you. Our atelier will confirm lead time when you enquire.',
    badgeClass: 'avail-mto',
  },
};

function normalizeAvailability(value) {
  return value === 'ready' ? 'ready' : 'mto';
}

function getAvailabilityMeta(type) {
  return AVAILABILITY_META[normalizeAvailability(type)] || AVAILABILITY_META.mto;
}

function renderAvailabilityBadge(type, { compact = false } = {}) {
  const meta = getAvailabilityMeta(type);
  const cls = compact ? 'availability-badge availability-badge--compact' : 'availability-badge';
  return `<span class="${cls} ${meta.badgeClass}" title="${meta.hint}">${meta.short}</span>`;
}

window.AVAILABILITY_DEFAULT = AVAILABILITY_DEFAULT;
window.AVAILABILITY_META = AVAILABILITY_META;
window.normalizeAvailability = normalizeAvailability;
window.getAvailabilityMeta = getAvailabilityMeta;
window.renderAvailabilityBadge = renderAvailabilityBadge;
