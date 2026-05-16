import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { CartProvider, useCart } from './src/state/CartContext';
import { I18nProvider } from './src/i18n';
import HomeScreen from './src/screens/HomeScreen';
import PartnerScreen from './src/screens/PartnerScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import TrackingScreen from './src/screens/TrackingScreen';
import PremiumScreen from './src/screens/PremiumScreen';
import PartnerOnboardingScreen from './src/screens/PartnerOnboardingScreen';
import RiderScreen from './src/screens/RiderScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Partner" component={PartnerScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { items, role } = useCart();
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
          const iconMap = {
            HomeTab: 'restaurant',
            CartTab: 'bag',
            RiderTab: 'bicycle',
            ProfileTab: 'person',
          };
          return <Ionicons name={iconMap[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          title: 'Cart',
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand },
        }}
      />
      {role === 'rider' && (
        <Tab.Screen
          name="RiderTab"
          component={RiderScreen}
          options={{ title: 'Deliveries' }}
        />
      )}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ title: 'Account' }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Tracking" component={TrackingScreen} />
      <Stack.Screen name="Premium" component={PremiumScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="PartnerOnboarding" component={PartnerOnboardingScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider defaultLang="ml">
        <CartProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </CartProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
