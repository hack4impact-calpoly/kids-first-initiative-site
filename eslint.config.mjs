import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import eslintConfigPrettier from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

// Flat config, required by ESLint 9. eslint-config-next v16 ships flat configs natively, so they
// are spread directly rather than bridged through FlatCompat.
//
// Deliberately mirrors the previous .eslintrc.json rule set (next/core-web-vitals + prettier).
// eslint-config-next/typescript is available and would add stricter rules such as no-explicit-any,
// but enabling it flags ~20 pre-existing errors across the app; that is a lint-policy decision for
// the team, not something to fold into a dependency upgrade.
const config = [
  { ignores: ["public/game/**/Build/**", ".next/**", "node_modules/**", "next-env.d.ts", "tsconfig.tsbuildinfo"] },
  ...nextCoreWebVitals,
  eslintConfigPrettier,
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    plugins: { prettier: prettierPlugin },
    rules: {
      "prettier/prettier": "error",
      // React Compiler-era rules new to the eslint-plugin-react-hooks bundled with
      // eslint-config-next 16. They flag six pre-existing components; each needs its effect or ref
      // usage reworked and verified in the browser, which does not belong in a dependency upgrade.
      // Kept visible as warnings and tracked separately rather than silenced or rushed.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default config;
