package com.cartridge.emulator.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [Game::class],
    version = 1,
    exportSchema = false
)
abstract class CartridgeDatabase : RoomDatabase() {

    abstract fun gameDao(): GameDao

    companion object {
        @Volatile private var INSTANCE: CartridgeDatabase? = null

        fun getInstance(context: Context): CartridgeDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    CartridgeDatabase::class.java,
                    "library.db"         // same filename as desktop
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
