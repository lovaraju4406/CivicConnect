import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../../store/authSlice";
import { useNavigate } from "react-router-dom";

interface FormData {
  email: string;
  password: string;
}

export default function LoginForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { register, handleSubmit } = useForm<FormData>();

  const onSubmit = (data: FormData) => {
    dispatch(
      loginSuccess({
        token: "demo-token",
        user: {
  id: "1",
  role: "citizen",
  name: "",
  email: ""
},
      })
    );

    navigate("/dashboard");
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white p-8 rounded-xl shadow-md w-96 space-y-4"
    >
      <h2 className="text-2xl font-bold text-center">Login</h2>

      <input
        {...register("email")}
        type="email"
        placeholder="Email"
        className="w-full border p-2 rounded"
      />

      <input
        {...register("password")}
        type="password"
        placeholder="Password"
        className="w-full border p-2 rounded"
      />

      <button className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
        Sign In
      </button>
    </form>
  );
}
