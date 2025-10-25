import React, { useContext, useEffect } from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import { AppContent } from "../context/AppContext";

const Home = () => {
  const { userData, getUserData, isLoggedin } = useContext(AppContent);

  useEffect(() => {
    // Fetch user data when page loads (only if not already fetched)
    if (!userData) {
      getUserData();
    }
  }, []);

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-[url("/bg_img.png")] bg-cover bg-center'>
      <Navbar />

      <Header />
    </div>
  );
};

export default Home;
