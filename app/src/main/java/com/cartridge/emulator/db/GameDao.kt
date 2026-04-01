package com.cartridge.emulator.db

import androidx.room.*

@Dao
interface GameDao {

    @Query("SELECT * FROM games ORDER BY system ASC, name ASC")
    fun getAllGames(): List<Game>

    @Query("SELECT * FROM games WHERE system = :system ORDER BY name ASC")
    fun getGamesBySystem(system: String): List<Game>

    @Query("SELECT * FROM games WHERE rom_path = :romPath LIMIT 1")
    fun getGameByRomPath(romPath: String): Game?

    @Query("SELECT * FROM games WHERE id = :id LIMIT 1")
    fun getGame(id: String): Game?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertGame(game: Game)

    @Query("UPDATE games SET boxart = :boxart, crc32 = COALESCE(:crc32, crc32) WHERE id = :id")
    fun updateBoxart(id: String, boxart: String, crc32: String?)

    @Query("UPDATE games SET name = :name WHERE id = :id")
    fun updateName(id: String, name: String)

    @Query("UPDATE games SET year = :year WHERE id = :id")
    fun updateYear(id: String, year: Int)

    @Query("UPDATE games SET play_time = play_time + :seconds, last_played = :timestamp WHERE id = :id")
    fun recordPlaySession(id: String, seconds: Int, timestamp: String)

    @Query("DELETE FROM games WHERE id IN (:ids)")
    fun deleteGames(ids: List<String>)
}
