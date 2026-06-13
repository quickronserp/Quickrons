// Web-safe confirmation helper.
//
// React Native Web's Alert.alert() renders the title + message but its action
// BUTTONS do not invoke their onPress callbacks reliably — the destructive
// callback simply never runs, so "Remove", "Cancel order", etc. silently do
// nothing on Expo Web / Chrome. This bit us on the partner Menu Manager.
//
// confirmAction() papers over that by using the browser's native window.confirm
// on web (which blocks and returns a boolean) and Alert.alert on native (where
// button callbacks work fine). It returns a Promise<boolean> so callers can
// `await` the decision instead of threading a callback through Alert's button
// array.
//
//   if (await confirmAction({ title: 'Remove item?', message: '…' })) {
//     await api.remove(id);
//   }

import { Alert, Platform } from 'react-native';

/**
 * Ask the user to confirm a (usually destructive) action.
 *
 * @param {object}  opts
 * @param {string}  opts.title          Heading shown to the user.
 * @param {string} [opts.message]       Supporting line.
 * @param {string} [opts.confirmLabel]  Label for the confirm button (native only). Default 'OK'.
 * @param {string} [opts.cancelLabel]   Label for the cancel button (native only). Default 'Cancel'.
 * @param {boolean}[opts.destructive]   Style the confirm button as destructive on native. Default true.
 * @returns {Promise<boolean>} resolves true if confirmed, false if cancelled.
 */
export function confirmAction({
  title,
  message = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = true,
} = {}) {
  // Web (and any environment exposing a synchronous window.confirm): use it.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(window.confirm(text));
  }

  // Native: Alert button callbacks work — wrap them in a promise.
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message || undefined,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
