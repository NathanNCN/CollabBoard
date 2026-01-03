"use client";
import { useRouter } from 'next/navigation';
import { Pen } from 'lucide-react';

export default function Home() {
    const router = useRouter();
    const createNewBoard = () => {
        const boardID = crypto.randomUUID();
        router.push(`/board/${boardID}`);
    }


    return (
        <div className="flex h-screen flex-col bg-white">
            {/* Header */}
            <header className="flex items-center justify-center border-b-2 px-6 py-4 shadow-sm">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                    CollabBoard
                </h1>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
                <div className="text-center space-y-8 px-6">
                    <div className="space-y-4">
                        <div className="flex justify-center">
                            <div className="p-6 rounded-full bg-gradient-to-r from-purple-100 via-pink-100 to-blue-100">
                                <Pen size={48} className="text-purple-600" />
                            </div>
                        </div>
                        <h2 className="text-4xl font-bold text-gray-900">
                            Welcome to CollabBoard
                        </h2>
                        <p className="text-lg text-gray-600 max-w-md mx-auto">
                            Create, collaborate, and share your ideas on an interactive whiteboard. 
                            Start drawing, add shapes, and bring your thoughts to life.
                        </p>
                    </div>
                    
                    <button
                        onClick={createNewBoard}
                        className="px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2 mx-auto"
                    >
                        <Pen size={20} />
                        Create New Board
                    </button>
                </div>
            </main>
        </div>
    );
}