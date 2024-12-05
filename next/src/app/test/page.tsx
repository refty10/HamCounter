"use client";

import { Run } from "@/types/model";
import { useMutation } from "@tanstack/react-query";

export default function Test() {
  const { mutate } = useMutation({
    mutationFn: (run: Run) => {
      console.log(JSON.stringify(run));
      return fetch("http://localhost:8000/run", {
        method: "POST",
        body: JSON.stringify(run),
        headers: {
          "Content-Type": "application/json",
        },
      }).then((res) => res.json());
    },
  });

  return (
    <div className="grid place-items-center min-w-screen min-h-screen">
      <button
        className="bg-blue-500 text-white p-2 px-4 rounded-md"
        onClick={() => {
          const random = Math.random() / 5;
          const distance = 0.2; // m

          mutate({
            from: new Date(),
            to: new Date(Date.now() + 200),
            seconds: random,
            speed: (distance / random) * 3.6, // km/h
          });
        }}
      >
        test
      </button>
    </div>
  );
}
