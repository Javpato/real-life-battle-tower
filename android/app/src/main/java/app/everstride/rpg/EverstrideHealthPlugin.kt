package app.everstride.rpg

import android.Manifest
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.PermissionState
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant

@CapacitorPlugin(name = "EverstrideHealth", permissions = [Permission(alias = "activity", strings = [Manifest.permission.ACTIVITY_RECOGNITION])])
class EverstrideHealthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class)
    )
    private fun hcAvailable() = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    private fun manager() = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private fun motionGranted() = Build.VERSION.SDK_INT < 29 || getPermissionState("activity") == PermissionState.GRANTED
    private fun client() = HealthConnectClient.getOrCreate(context)

    @PluginMethod fun availability(call: PluginCall) {
        val sensor = manager().getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
        val hc = hcAvailable()
        call.resolve(JSObject().put("available", sensor || hc).put("stepCounter", sensor).put("healthConnect", hc)
            .put("reason", if (sensor || hc) "Device permission is required before reading." else "No step sensor or Health Connect provider is available."))
    }
    @PluginMethod fun requestHealthPermissions(call: PluginCall) {
        if (!motionGranted()) requestPermissionForAlias("activity", call, "afterMotionPermission") else requestHealth(call)
    }
    @PermissionCallback private fun afterMotionPermission(call: PluginCall) { requestHealth(call) }
    private fun requestHealth(call: PluginCall) {
        if (!hcAvailable()) { call.resolve(JSObject().put("activityRecognition", motionGranted()).put("healthConnect", false)); return }
        val contract = PermissionController.createRequestPermissionResultContract()
        startActivityForResult(call, contract.createIntent(context, permissions), "afterHealthPermission")
    }
    @ActivityCallback private fun afterHealthPermission(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        scope.launch {
            try { val granted = client().permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("activityRecognition", motionGranted()).put("healthConnect", granted.containsAll(permissions)))
            } catch (e: Exception) { call.reject("Could not read Health Connect permissions: ${e.message}") }
        }
    }
    private fun range(call: PluginCall): Pair<Instant, Instant> {
        val start = Instant.parse(call.getString("startTime") ?: throw IllegalArgumentException("startTime is required"))
        val end = call.getString("endTime")?.let { Instant.parse(it) } ?: Instant.now()
        require(start < end && end <= Instant.now().plusSeconds(30)) { "Invalid health time range" }
        return Pair(start, end)
    }
    @PluginMethod fun readSteps(call: PluginCall) {
        val requestedSource = call.getString("source")
        if (requestedSource == "step-counter" || (requestedSource == null && !hcAvailable())) { sensorSteps(call); return }
        if (!hcAvailable()) { call.reject("Health Connect is unavailable. Select the step-counter source explicitly."); return }
        scope.launch {
            try {
                val (start, end) = range(call)
                val result = client().aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(start, end)))
                call.resolve(JSObject().put("source", "health-connect").put("steps", result[StepsRecord.COUNT_TOTAL] ?: 0L)
                    .put("startTime", start.toString()).put("endTime", end.toString()))
            } catch (e: Exception) { call.reject("Unable to read steps; check permissions. ${e.message}") }
        }
    }
    private fun sensorSteps(call: PluginCall) {
        if (!motionGranted()) { call.reject("Activity recognition permission is required."); return }
        val sensor = manager().getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        if (sensor == null) { call.reject("This device has no step counter."); return }
        val start = try { range(call).first.toString() } catch(e: Exception) { call.reject(e.message); return }
        val handler = Handler(Looper.getMainLooper())
        val preferences = context.getSharedPreferences("everstride_step_baselines", Context.MODE_PRIVATE)
        val boot = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1).toString()
        var finished = false
        lateinit var timeout: Runnable
        val listener = object : SensorEventListener {
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
            override fun onSensorChanged(event: SensorEvent) {
                if (finished) return
                finished = true; manager().unregisterListener(this); handler.removeCallbacks(timeout)
                val current = event.values[0].toLong()
                val oldStart = preferences.getString("start", null)
                val oldBoot = preferences.getString("boot", null)
                val baseline: Long
                if (oldStart != start) {
                    baseline = current
                    preferences.edit().putString("start", start).putString("boot", boot).putLong("baseline", baseline).apply()
                } else {
                    if (oldBoot != boot || current < preferences.getLong("baseline", current)) {
                        call.reject("STEP_COUNTER_RESET: start a new reward epoch after device reboot."); return
                    }
                    baseline = preferences.getLong("baseline", current)
                }
                call.resolve(JSObject().put("source", "step-counter").put("steps", current - baseline)
                    .put("startTime", start).put("endTime", Instant.now().toString()).put("bootId", boot))
            }
        }
        timeout = Runnable { if (!finished) { finished = true; manager().unregisterListener(listener); call.reject("No step sensor reading arrived. Walk a few steps and retry.") } }
        if (!manager().registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)) { call.reject("Could not register the step sensor."); return }
        handler.postDelayed(timeout, 12000)
    }
    @PluginMethod fun importHealth(call: PluginCall) {
        if (!hcAvailable()) { call.reject("Health Connect is unavailable on this device."); return }
        scope.launch {
            try {
                val (start, end) = range(call)
                val hc = client()
                val granted = hc.permissionController.getGrantedPermissions()
                if (!granted.contains(HealthPermission.getReadPermission(StepsRecord::class))) { call.reject("Health Connect step permission is required."); return@launch }
                val filter = TimeRangeFilter.between(start, end)
                val steps = hc.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), filter))
                val result = JSObject().put("startTime",start.toString()).put("endTime",end.toString())
                    .put("steps", steps[StepsRecord.COUNT_TOTAL] ?: 0L).put("sleepMinutes",JSONObject.NULL)
                    .put("activeCalories",JSONObject.NULL).put("weightKg",JSONObject.NULL)
                val sources = mutableSetOf<String>(); steps.dataOrigins.forEach { sources.add(it.packageName) }
                if (granted.contains(HealthPermission.getReadPermission(SleepSessionRecord::class))) {
                    val sleep = hc.aggregate(AggregateRequest(setOf(SleepSessionRecord.SLEEP_DURATION_TOTAL), filter))
                    sleep[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.let { result.put("sleepMinutes", it.toMinutes()) }
                    sleep.dataOrigins.forEach { sources.add(it.packageName) }
                }
                if (granted.contains(HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class))) {
                    val energy = hc.aggregate(AggregateRequest(setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL), filter))
                    energy[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let { result.put("activeCalories", it.inKilocalories) }
                    energy.dataOrigins.forEach { sources.add(it.packageName) }
                }
                if (granted.contains(HealthPermission.getReadPermission(WeightRecord::class))) {
                    val weights = hc.readRecords(ReadRecordsRequest(WeightRecord::class, filter, ascendingOrder=false, pageSize=1))
                    weights.records.firstOrNull()?.let { result.put("weightKg", it.weight.inKilograms); sources.add(it.metadata.dataOrigin.packageName) }
                }
                result.put("sources", JSArray(sources.toList())); call.resolve(result)
            } catch (e: Exception) { call.reject("Health import failed; no diary data was changed. ${e.message}") }
        }
    }
    override fun handleOnDestroy() { scope.cancel(); super.handleOnDestroy() }
}
