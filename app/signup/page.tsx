import React from "react";
import AuthForm from "@/components/AuthForm";
import LandingLayout from "@/components/shared/LandingLayout";

export default function SignupPage() {
  return (
    <LandingLayout>
      <div className="w-full flex justify-center animate-in fade-in duration-700 zoom-in-95 mt-[-40px]">
        <div className="w-full max-w-[440px]">
          <AuthForm mode="signup" />
        </div>
      </div>
    </LandingLayout>
  );
}
