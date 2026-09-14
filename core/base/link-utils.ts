/**
 * Shared link/rel utilities — used by Flex, Button, Text and any component
 * that can render as `<a>`.
 */

const EXTERNAL_PROTOCOL_RE = /^[a-z][a-z\d+\-.]*:/i;

export const buildRel = (
  base: string | undefined,
  opts: { nofollow?: boolean; noreferrer?: boolean; noopener?: boolean },
): string | undefined => {
  const parts = (base ? base.split(' ') : []).filter(Boolean);
  if (opts.nofollow) parts.push('nofollow');
  if (opts.noreferrer) parts.push('noreferrer');
  if (opts.noopener) parts.push('noopener');
  return Array.from(new Set(parts)).join(' ') || undefined;
};

export const isInternalHref = (href?: string): boolean => {
  if (!href) return false;
  if (href.startsWith('//')) return false;
  if (EXTERNAL_PROTOCOL_RE.test(href)) return false;

  return href.startsWith('/') || href.startsWith('#') || href.startsWith('?');
};

export const shouldUseNextLink = (href?: string, target?: string, download?: string | boolean): boolean => {
  if (!isInternalHref(href)) return false;
  if (target && target !== '_self') return false;
  if (download) return false;
  return true;
};

/**
 * Resolves href / target / rel from a common set of link-related props.
 * Returns an empty object when `href` is falsy (non-link case).
 */
export const resolveLinkProps = (input: {
  href?: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
  newTab?: boolean;
  nofollow?: boolean;
  noreferrer?: boolean;
}): { href?: string; target?: string; rel?: string; download?: string | boolean } => {
  if (!input.href) return {};
  return {
    href: input.href,
    target: input.newTab ? '_blank' : input.target,
    download: input.download,
    rel: buildRel(input.rel, {
      nofollow: input.nofollow,
      noreferrer: input.newTab || input.noreferrer,
      noopener: input.newTab || undefined,
    }),
  };
};
