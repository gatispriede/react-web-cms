import NextAuth from "next-auth/next";
export {authOptions} from "./authOptions";
import {authOptions} from "./authOptions";
export default NextAuth(authOptions);
