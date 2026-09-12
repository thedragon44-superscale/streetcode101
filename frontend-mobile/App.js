import "./global.css";
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 bg-slate-950 justify-center items-center p-4">
      <Text className="text-2xl font-black text-white uppercase tracking-wider mb-1">
        Street Code <Text className="text-orange-500">101</Text>
      </Text>
      <Text className="text-cyan-500 font-bold text-xs uppercase tracking-widest">
        Native Mobile Engine Active
      </Text>
      <StatusBar style="light" />
    </View>
  );
}
