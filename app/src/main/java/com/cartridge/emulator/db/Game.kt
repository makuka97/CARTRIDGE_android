package com.cartridge.emulator.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Mirrors the desktop `games` table schema from db/db.js exactly.
 * Field names kept identical for easy JSON round-tripping with the JS renderer.
 */
@Entity(tableName = "games")
data class Game(
    @PrimaryKey
    @ColumnInfo(name = "id")          val id: String,
    @ColumnInfo(name = "name")        val name: String,
    @ColumnInfo(name = "system")      val system: String,
    @ColumnInfo(name = "core")        val core: String,
    @ColumnInfo(name = "rom_path")    val romPath: String,
    @ColumnInfo(name = "boxart")      val boxart: String?      = null,
    @ColumnInfo(name = "crc32")       val crc32: String?       = null,
    @ColumnInfo(name = "year")        val year: Int?           = null,
    @ColumnInfo(name = "play_time")   val playTime: Int        = 0,
    @ColumnInfo(name = "last_played") val lastPlayed: String?  = null,
    @ColumnInfo(name = "added_at")    val addedAt: String
)
