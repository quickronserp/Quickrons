import React, { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CartProvider, useCart } from './src/state/CartContext';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import { I18nProvider, useI18n } from './src/i18n';

import HomeScreen              from './src/screens/HomeScreen';
import PartnerScreen           from './src/screens/PartnerScreen';
import CartScreen              from './src/screens/CartScreen';
import CheckoutScreen          from './src/screens/CheckoutScreen';
import TrackingScreen          from './src/screens/TrackingScreen';
import MyOrdersScreen          from './src/screens/MyOrdersScreen';
import PremiumScreen           from './src/screens/PremiumScreen';
import PartnerOnboardingScreen from './src/screens/PartnerOnboardingScreen';
import RiderScreen             from './src/screens/RiderScreen';
import ProfileScreen           from './src/screens/ProfileScreen';
import LoginScreen             from './src/screens/LoginScreen';
import OtpVerifyScreen         from './src/screens/OtpVerifyScreen';
import PartnerOpsScreen        from './src/screens/PartnerOpsScreen';
import RiderOpsScreen          from './src/screens/RiderOpsScreen';
import AdminOpsScreen          from './src/screens/AdminOpsScreen';
import LanguageSelectScreen    from './src/screens/LanguageSelectScreen';
import PartnerMenuScreen       from './src/screens/PartnerMenuScreen';
import PartnerBrandingScreen   from './src/screens/PartnerBrandingScreen';

import { colors } from './src/theme';

// Single QueryClient instance — lives for the app's lifetime.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Home (browse → partner) ─────────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Partner"  component={PartnerScreen} />
    </Stack.Navigator>
  );
}

// ─── Bottom tabs (post-auth) ─────────────────────────────────────────────
function MainTabs() {
  const { items } = useCart();
  const cartCount = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { borderTopColor: colors.border, height: 60, paddingTop: 6, paddingBottom: 8 },
        tabBarIcon: ({ color, size }) => {
          const map = {
            HomeTab:    'restaurant',
            CartTab:    'bag',
            ProfileTab: 'person',
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab"    component={HomeStack}    options={{ title: 'Home' }} />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          title: 'Cart',
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand },
        }}
      />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Account' }} />
    </Tab.Navigator>
  );
}

// ─── Boot splash while AuthContext is restoring storage ──────────────────
function BootSplash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

// ─── Unauthenticated stack ───────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"     component={LoginScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
    </Stack.Navigator>
  );
}

// ─── Authenticated stack (tabs + modals) ─────────────────────────────────
function MainStack() {
  return (
    <Stack.Navigator initialRouteName="Tabs" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"              component={MainTabs} />
      <Stack.Screen name="Cart"              component={CartScreen}              options={{ presentation: 'modal' }} />
      <Stack.Screen name="Checkout"          component={CheckoutScreen}          options={{ presentation: 'modal' }} />
      <Stack.Screen name="Tracking"          component={TrackingScreen} />
      <Stack.Screen name="MyOrders"          component={MyOrdersScreen} />
      <Stack.Screen name="Premium"           component={PremiumScreen}           options={{ presentation: 'modal' }} />
      <Stack.Screen name="PartnerOnboarding" component={PartnerOnboardingScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Profile"           component={ProfileScreen} />
      <Stack.Screen name="Rider"             component={RiderScreen} />
      <Stack.Screen name="PartnerOps"        component={PartnerOpsScreen} />
      <Stack.Screen name="PartnerMenu"       component={PartnerMenuScreen} />
      <Stack.Screen name="PartnerBranding"   component={PartnerBrandingScreen} />
      <Stack.Screen name="RiderOps"          component={RiderOpsScreen} />
      <Stack.Screen name="AdminOps"          component={AdminOpsScreen} />
    </Stack.Navigator>
  );
}

// ─── Role-specific root stacks ────────────────────────────────────────────
function PartnerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PartnerOps"      component={PartnerOpsScreen} />
      <Stack.Screen name="PartnerMenu"     component={PartnerMenuScreen} />
      <Stack.Screen name="PartnerBranding" component={PartnerBrandingScreen} />
    </Stack.Navigator>
  );
}

function RiderStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RiderOps" component={RiderOpsScreen} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminOps" component={AdminOpsScreen} />
    </Stack.Navigator>
  );
}

// ─── Root: pick stack based on role ──────────────────────────────────────
function RootNavigator() {
  const { isAuthenticated, bootstrapping, accessToken, user, signOut } = useAuth();
  const { hasChosen, bootstrapping: i18nBoot } = useI18n();

  // Dev escape hatch — open  http://localhost:8082/?signout=1  to force-clear a stale session.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('signout') === '1') {
        signOut();
        const url = new URL(window.location.href);
        url.searchParams.delete('signout');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, [signOut]);

  // eslint-disable-next-line no-console
  if (__DEV__) {
    console.log('[auth]', {
      bootstrapping,
      i18nBoot,
      hasChosen,
      isAuthenticated,
      hasToken: !!accessToken,
      userPhone: user?.phone,
      userRole: user?.role,
    });
  }

  if (bootstrapping || i18nBoot) return <BootSplash />;

  // First launch gate: prompt for language BEFORE auth so the login screen
  // already reflects the user's preferred language.
  if (!hasChosen) {
    return (
      <Stack.Navigator key="lang" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
      </Stack.Navigator>
    );
  }

  if (!isAuthenticated) return <AuthStack key="auth" />;

  // Route by role — non-customer roles get their own root stack (no tabs, no cart).
  const role = user?.role;
  if (role === 'PARTNER') return <PartnerStack key="partner" />;
  if (role === 'RIDER')   return <RiderStack   key="rider"   />;
  if (role === 'ADMIN')   return <AdminStack   key="admin"   />;

  // Default: CUSTOMER
  return <MainStack key="main" />;
}

// ─── App entry — provider order matters ──────────────────────────────────
// QueryClientProvider → SafeAreaProvider → I18nProvider → AuthProvider → CartProvider → NavigationContainer
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <I18nProvider defaultLang="en">
          <AuthProvider>
            <CartProvider>
              <NavigationContainer>
                <StatusBar style="dark" />
                <RootNavigator />
              </NavigationContainer>
            </CartProvider>
          </AuthProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
