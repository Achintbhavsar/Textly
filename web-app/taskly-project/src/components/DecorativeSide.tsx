import React from 'react';

interface DecorativeSideProps {
  mode: 'login' | 'signup';
}

export const DecorativeSide: React.FC<DecorativeSideProps> = ({ mode }) => {
  return (
    <div className="hidden lg:flex lg:w-1/2 relative bg-blue-600 overflow-hidden items-center justify-center p-12 transition-all duration-700 ease-in-out">
      {/* Background Gradients & Blobs */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-[#7c7af0] to-violet-400 dark:from-slate-900 dark:via-blue-600 dark:to-indigo-900 opacity-95"></div>
      
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-indigo-900 rounded-full mix-blend-multiply filter blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-lg text-white text-center flex flex-col items-center">
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-10 self-center lg:self-start">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 shadow-xl">
            <span className="material-icons text-white text-2xl">
              {mode === 'login' ? 'textsms' : 'textsms'}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Textly</h1>
        </div>

        {/* Dynamic Content based on mode */}
        <div className="transition-all duration-500 transform">
          {mode === 'login' ? (
            <div className="space-y-8">
              <div className="p-6 rounded-3xl shadow-2xl inline-block bg-white/10 backdrop-blur-sm">
                <img 
                  alt="Growth visualization" 
                  className="w-full h-64 object-cover rounded-2xl"
                  src="https://i.pinimg.com/736x/22/5a/ac/225aacc16c95e9fd86b30c68d3e2a3ad.jpg" 
                />
              </div>
              <div>
                <h2 className="text-4xl font-bold leading-tight mb-4">Secure. Fast. Synchronized</h2>
                <p className="text-indigo-100 text-lg">Textly keeps your tasks and login history synchronized in real-time.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <h2 className="text-5xl font-extrabold leading-tight mb-6 text-left">Own your tasks,<br/>Track synchronized.</h2>
              <p className="text-xl text-white/90 leading-relaxed mb-8 text-left">Join thousands of users who have streamlined their productivity in one unified workspace.</p>
               
               <div className="flex items-center space-x-6 pt-10 border-t border-white/20">
                <div className="flex -space-x-4">
                  <img className="w-12 h-12 rounded-full border-4 border-blue-600 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCY9SKHPW-AvM3igp_G7kChQGF2QAznQK5SUb5SQeRnlWWybLHQLQG9A_0Cx-nRAd83CLjjsyHDDx2qsziIXneE8uv-H2xCtm7ibdacepQB1Yb0cgp-clfKp9DTYDAOJzt5BF3ddVts2OeohG62urN6MgL_w2tb4gIY2CtVDh1ddMNCq4sbgoR_Q41RYRLVZZ8mSEH87k_mf6UNpYWoPhh__mrv3yPd1MJXbbsCz7d6PW0m_UUU79rcxT_rQ7pOxImAPtS0PUOgTnY" alt="U1" />
                  <img className="w-12 h-12 rounded-full border-4 border-blue-600 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6LLS1E_oYr2VsErZiYAG8NKrN37K2cLoFWdiCiLwkDoVpw4IKzZhiPS5leNa1J8AuQXLQKZpmhXla3U-vcSjpVvFnPep1gA0tsRH2HLwSQw5qaW_MWh3jLm0EM7_tUt_W9jI7cExTYh7i5ZKjHdROfqXzyfFb0fRF4OoeBhCsX-7FdpYYYmRsuyCmsxyD8TVZVfGGARZA7X7z9hYwiYzqiLyZl2JkAT1LvxiC0JO8RAD7GLHa_oBpdGYYR5TyoOBLwVq3eaPqUAw" alt="U2" />
                  <img className="w-12 h-12 rounded-full border-4 border-blue-600 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuhCmvavQtDvrWShdIpQ9oKCz69GDoHlBt5Q3fVBRKKLFvje0ujECyxSDOvyY4fVosPK1d7Ii2JdFd2NORKd8tRAOV2P7bLEZRVonTmDOHc3MzRj667D7H_jF4XI5VFEoyZu0xQem4H4hHBOzwp9AhzcHNQwkRuq4T9lUJYsBYMSKiNxxmV65F037i2Owl8NR0asLPSepV_IQBDiGubxyvhNhYfqgiUssPgzd9hD1A-NoMrFNsvBQ9y_CTRUfpCZsSGs0HFRifHtE" alt="U3" />
                </div>
                <div className="text-left font-medium">
                  <p className="text-lg">Trusted by 10,000+ users</p>
                  <div className="flex text-yellow-300 gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => <span key={i} className="material-icons text-xl">star</span>)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Carousel indicators */}
        <div className="mt-16 flex justify-center gap-3">
          <div className={`h-2 rounded-full bg-white transition-all ${mode === 'login' ? 'w-8' : 'w-2 opacity-40'}`}></div>
          <div className={`h-2 rounded-full bg-white transition-all ${mode === 'signup' ? 'w-8' : 'w-2 opacity-40'}`}></div>
          <div className="h-2 w-2 rounded-full bg-white/40"></div>
        </div>
      </div>
    </div>
  );
};