import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });
const config = compat.extends("next/core-web-vitals", "next/typescript");
const eslintConfig = [
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
  ...config,
];

export default eslintConfig;
