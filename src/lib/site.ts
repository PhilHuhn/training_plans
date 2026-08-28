/**
 * Operator details for the legally required pages.
 *
 * Club Turbine is run by a private individual, so § 5 DDG asks for name, a
 * deliverable postal address, an email address and a second channel that allows
 * direct and efficient contact. There is no register entry, no VAT ID and no
 * supervisory authority to name.
 *
 * The email is kept split so it can be assembled in the browser rather than
 * sitting in the served HTML as one scrapable string — see ObfuscatedEmail.
 */
export const site = {
  name: 'Club Turbine',
  operator: {
    name: 'Philipp Huhn',
    street: 'Max-Brauer-Allee 183e',
    postalCode: '22765',
    city: 'Hamburg',
    country: 'Deutschland',
  },
  email: {
    user: 'philipp.huhn',
    domain: 'outlook.de',
  },
  /**
   * How quickly the contact form is answered. § 5 DDG requires a channel for
   * "direct and efficient" contact; the ECJ (C-298/07) accepted a web form in
   * place of a phone number where replies arrive promptly. Stating a realistic
   * window here is what makes the form defensible — keep it truthful.
   */
  contactResponseTime: 'in der Regel innerhalb von 24 Stunden, spätestens nach zwei Werktagen',
  /**
   * Where donations go.
   *
   * Deliberately a plain link and not Ko-fi's floating-widget script. The
   * widget loads third-party JavaScript on every page view, which transmits the
   * visitor's IP and sets Ko-fi's own cookies before anyone has clicked
   * anything — and the privacy policy states, in as many words, that
   * `access_token` is the only cookie and that no tracking cookies are used. A
   * link transfers nothing until it is followed, so that statement stays true
   * and no consent banner is needed.
   *
   * The URL is written out rather than built from the username so a typo in
   * either shows up as a mismatch — see the test.
   */
  kofi: {
    username: 'philipphuhn',
    url: 'https://ko-fi.com/philipphuhn',
  },
  lastUpdated: '2026-08-28',
} as const

export const emailAddress = `${site.email.user}@${site.email.domain}`
