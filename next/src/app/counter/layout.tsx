"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FC, ReactNode } from "react";

// SSGをしないように
export const dynamic = "force-dynamic";

const queryClient = new QueryClient();

type Props = {
  children: ReactNode;
};

const TestLayout: FC<Props> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

export default TestLayout;
