import { OnboardingChat } from "@/components/onboarding/OnboardingChat";

export default function OnboardingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#1e1e1e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <OnboardingChat />
    </main>
  );
}