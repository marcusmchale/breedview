<template>
  <!--<div v-if="$apollo.loading">Loading...</div>
  <div v-else>-->
  <div>
    <h1>{{ msg }}</h1>
    <FormulateForm
      class="form"
      v-model="formValues"
      @submit="submitHandler"
    >
      <FormulateInput
        :options="get_teams.map(t => ({ value: t.name, label: t.fullname }))"
        type="select"
        name="team"
        placeholder="Select Team"
        label="Team"
        validation="required"
      />
      <FormulateInput
        type="text"
        name="fullname"
        label="Full Name"
        placeholder="Enter your full name"
        validation="required"
      />
      <FormulateInput
        type="email"
        name="email"
        label="Email"
        validation="bail|required|email|validEmail"
        placeholder="Enter your email address"
        :validation-rules="{
          validEmail: () => {
            return this.allowed_email;
          }
        }"
        :validation-messages="{
          validEmail: () => 'Email address must be registered by a team admin'
        }"
      />
      <FormulateInput
        type="text"
        name="username"
        label="Username"
        placeholder="Enter a username for this site"
        validation="required"
      />
      <FormulateInput
        type="password"
        name="password"
        label="Password"
        placeholder="Enter a password for this site"
        validation="required"
      />
      <FormulateInput type="submit" name="Register" :disabled="formDisabled"/>
    </FormulateForm>
  </div>
</template>

<script>
import GetTeams from "../graphql/GetTeams.graphql";
import AddAccount from "../graphql/AddAccount.graphql";
import AllowedEmail from "../graphql/AllowedEmail.graphql";

export default {
  name: "Registration",
  props: {
    msg: String
  },
  data() {
    return {
      formValues: { email: "" },
      get_teams: [],
      allowed_email: false,
      formDisabled: false
    };
  },
  apollo: {
    get_teams: GetTeams,
    allowed_email: {
      query: AllowedEmail,
      variables() {
        return { email: this.formValues.email };
      },
      update(data) {
        return data.allowed_email;
      }
    }
  },
  methods: {
    submitHandler(data) {
      this.formDisabled = true;
      this.$apollo
        .mutate({
          mutation: AddAccount,
          variables: {
            username: data.username,
            fullname: data.fullname,
            email: data.email,
            team_name: data.team,
            password: data.password
          },
          update: () => {
            this.formDisabled = false;
            alert(
              `Welcome ${data.fullname}.\n
               Please check your email to confirm.`
            );
            console.log("Success");
          }
        })
        .catch(error => {
          console.error(error);
        });

    }
  }
};
</script>

