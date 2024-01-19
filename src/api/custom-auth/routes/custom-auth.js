module.exports = {
  routes: [
    {
      method: "POST",
      path: "/login",
      handler: "custom-auth.login",
      config: {
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/register",
      handler: "custom-auth.register",
      config: {
        policies: [],
      },
    },
  ],
};
