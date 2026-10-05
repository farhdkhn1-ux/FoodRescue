"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [foods, setFoods] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getFoods() {
      const { data, error } = await supabase
        .from("foods")
        .select("*");

      if (error) {
        setError(error.message);
        return;
      }

      setFoods(data || []);
    }

    getFoods();
  }, []);

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">Food Rescue</h1>

      <h2 className="mt-8 text-xl font-semibold">
        Data Foods dari Supabase
      </h2>

      {error && (
        <p className="mt-4 text-red-500">
          Error: {error}
        </p>
      )}

      {!error && foods.length === 0 && (
        <p className="mt-4">
          Tidak ada data yang bisa ditampilkan.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {foods.map((food) => (
          <div
            key={food.id}
            className="rounded-lg border p-4"
          >
            <h3 className="font-bold">{food.name}</h3>
            <p>Harga: Rp {food.price}</p>
            <p>Stok: {food.quantity}</p>
            <p>Status: {food.status}</p>
          </div>
        ))}
      </div>
    </main>
  );
}