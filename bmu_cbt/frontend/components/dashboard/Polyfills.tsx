'use client'

// Runtime polyfills for older-but-supported browsers (Chrome 64+, Firefox 63+,
// Safari 12+). Next.js transpiles modern JS *syntax* down to those targets, but
// it does not polyfill every modern *runtime API*. These core-js modules fill
// that gap for the APIs used by the app and its dependencies. This component is
// rendered first inside the layout so the polyfills execute before app code.
import 'core-js/stable/array/at'
import 'core-js/stable/array/find-last'
import 'core-js/stable/array/flat'
import 'core-js/stable/array/flat-map'
import 'core-js/stable/object/from-entries'
import 'core-js/stable/string/pad-start'
import 'core-js/stable/string/replace-all'
import 'core-js/stable/string/trim-end'
import 'core-js/stable/string/trim-start'
import 'core-js/stable/promise/all-settled'
import 'core-js/stable/promise/finally'
import 'core-js/stable/global-this'

export default function Polyfills() {
  return null
}
