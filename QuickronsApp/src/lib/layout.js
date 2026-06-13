// Mobile-first responsive layout helpers.
//
// Quickrons is a phone-first app. On a wide desktop browser, React Native Web
// stretches every screen edge-to-edge, which looks like an "admin console", not
// a delivery app. We keep the experience phone-shaped by capping content to a
// comfortable column and centering it. On a real phone (width <= the cap) this
// is a no-op — content still fills the screen.

import { StyleSheet } from 'react-native';

// A phone-ish column. ~520 keeps cards readable on tablet/desktop without
// feeling cramped on a large phone.
export const MAX_CONTENT_WIDTH = 520;

export const layout = StyleSheet.create({
  // Wrap a screen's content (header + body + footer) so everything lines up
  // in one centered column on web while filling the height.
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  // For a single block (e.g. a ScrollView's contentContainer) that should be
  // centered without taking over height.
  centeredBlock: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
});
