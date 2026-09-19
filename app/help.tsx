import { View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors } from "@/theme";

export default function Help() {
  const router = useRouter();
  return (
    <Screen dockInset={false}>
      <View style={{ marginTop: 20, gap: 8, marginBottom: 28 }}>
        <Text variant="display">Help</Text>
        <Text variant="body" color={colors.onSurfaceVariant}>A quick refresher on how The-Wall works.</Text>
      </View>
      <View style={{ gap: 12 }}>
        <Button label="Replay the quick tour" variant="yellow" onPress={() => router.push("/walkthrough?replay=1")} />
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
