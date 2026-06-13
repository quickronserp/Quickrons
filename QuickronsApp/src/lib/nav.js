// Navigation helpers.
//
// On the web, a screen can be the very first entry in its navigator's history
// (e.g. the user deep-links straight to /Checkout, or lands on Tracking after
// `navigation.replace`). Calling navigation.goBack() there throws:
//
//   The action 'GO_BACK' was not handled by any navigator.
//
// goHomeOrBack() goes back when there IS somewhere to go, and otherwise routes
// to a sensible home destination instead of dead-ending.

/**
 * Go back if possible; otherwise navigate to a safe fallback (the customer Home).
 *
 * @param {object} navigation  react-navigation navigation prop
 * @param {string} [fallback]  route to navigate to when there's no back stack.
 *                             Defaults to the customer Home tab.
 */
export function goHomeOrBack(navigation, fallback) {
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  if (fallback) {
    navigation.navigate(fallback);
    return;
  }
  // Default customer fallback: the Home tab inside the main tab navigator.
  // navigate() to the tab works whether we're already inside Tabs or one
  // level up in the root stack.
  try {
    navigation.navigate('Tabs', { screen: 'HomeTab' });
  } catch {
    navigation.navigate('HomeTab');
  }
}
