const config = {
  plugins: [
    "@tailwindcss/postcss",
    "autoprefixer",
    process.env.NODE_ENV === "production"
      ? [
          "cssnano",
          {
            preset: [
              "default",
              {
                discardComments: { removeAll: true },
                normalizeWhitespace: false,
              },
            ],
          },
        ]
      : false,
  ].filter(Boolean),
};

export default config;
