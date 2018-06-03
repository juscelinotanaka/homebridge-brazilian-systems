var wpi = require('wiringpi-node');

module.exports = {
  DHT11: DHT11
};

function DHT11Result(error_code, temperature, humidity) {
    this.ERR_NO_ERROR = 0;
    this.ERR_MISSING_DATA = 1;
    this.ERR_CRC = 2;

    this.error_code = error_code;
    this.temperature = temperature;
    this.humidity = humidity;
}

DHT11Result.prototype.is_valid = function(error_code) {
  return error_code == this.ERR_NO_ERROR;
}

function DHT11(pin) {
    this.__pin = pin;
    wpi.setup('gpio');

    console.log("DHT INITIALIZED");
}

DHT11.prototype = {
    read: function () {
        wpi.pinMode(this.__pin, wpi.OUTPUT);

        // send initial high
        wpi.digitalWrite(this.__pin, wpi.HIGH);
        setTimeout(() => {
            // pull down to low after 0.05s
            wpi.digitalWrite(this.__pin, wpi.LOW);
            setTimeout(() => {
                // complete reading after 0.02s

                wpi.pinMode(this.__pin, wpi.INPUT);

                // collect data into an array
                data = this.__collect_input();

                var outstr = "";

                console.log("outstr: " + outstr);
                for (var i = 0; i < data.length; i++) {
                    outstr += (data[i]);
                }

                console.log("data: " + data.length + " : " + outstr);

                
                this.completeRead();
            }, 18);
        }, 10);
    },

    completeRead: function () {



        // parse lengths of all data pull up periods
        pull_up_lengths = this.__parse_data_pull_up_lengths(data);

        console.log("colected data: " + pull_up_lengths.length);

        // if bit count mismatch, return error (4 byte data + 1 byte checksum)
        if (pull_up_lengths.length != 40) {
            console.log("ERR_MISSING_DATA error");
            return DHT11Result(DHT11Result.ERR_MISSING_DATA, 0, 0);
        }

        // calculate bits from lengths of the pull up periods
        bits = this.__calculate_bits(pull_up_lengths);

        // we have the bits, calculate bytes
        the_bytes = this.__bits_to_bytes(bits);

        // calculate checksum and check
        checksum = this.__calculate_checksum(the_bytes);

        if (the_bytes[4] != checksum) {
            console.log("Checksum error");
            return DHT11Result(DHT11Result.ERR_CRC, 0, 0);
        }

        // ok, we have valid data, return it
        console.log("NO error");
        return DHT11Result(DHT11Result.ERR_NO_ERROR, the_bytes[2], the_bytes[0]);
    },

    __collect_input: function() {
        // collect the data while unchanged found
        unchanged_count = 0

        // this is used to determine where is the end of the data
        max_unchanged_count = 300

        var last = -1;
        var data = [];

        while (true) {
            current = wpi.digitalRead(this.__pin);
            data.push(current);
            if (last != current) {
                unchanged_count = 0;
                last = current;
            } else {
                unchanged_count += 1;
                if (unchanged_count > max_unchanged_count)
                    break;
            }
        }
        return data;
    },

    __parse_data_pull_up_lengths: function(data){
        STATE_INIT_PULL_DOWN = 1;
        STATE_INIT_PULL_UP = 2;
        STATE_DATA_FIRST_PULL_DOWN = 3;
        STATE_DATA_PULL_UP = 4;
        STATE_DATA_PULL_DOWN = 5;

        state = STATE_INIT_PULL_DOWN;

        lengths = []; // will contain the lengths of data pull up periods
        current_length = 0; // will contain the length of the previous period

        for (var i = 0; i < data.length; i++) {
            current = data[i];
            current_length += 1;

            if (state == STATE_INIT_PULL_DOWN) {
                if (current == 0) {
                    // ok, we got the initial pull down
                    state = STATE_INIT_PULL_UP;
                    continue;
                } else
                    continue;
            }

            if (state == STATE_INIT_PULL_UP) {
                if (current == 1) {
                    // ok, we got the initial pull up
                    state = STATE_DATA_FIRST_PULL_DOWN;
                    continue;
                } else
                    continue;
            }

            if (state == STATE_DATA_FIRST_PULL_DOWN) {
                if (current == 0) {
                    // we have the initial pull down, the next will be the data pull up
                    state = STATE_DATA_PULL_UP;
                    continue
                } else
                    continue
            }

            if (state == STATE_DATA_PULL_UP) {
                if (current == 1) {
                    // data pulled up, the length of this pull up will determine whether it is 0 or 1
                    current_length = 0;
                    state = STATE_DATA_PULL_DOWN;
                    continue;
                }
                else
                    continue;
            }

            if (state == STATE_DATA_PULL_DOWN){
                if (current == 0) {
                    // pulled down, we store the length of the previous pull up period
                    lengths.push(current_length);
                    state = STATE_DATA_PULL_UP;
                    continue;
                }
                else
                    continue;
            }
        }

        return lengths;
    },

    __calculate_bits: function(pull_up_lengths) {
        // find shortest and longest period
        var shortest_pull_up = 1000
        var longest_pull_up = 0

        for (var i = 0; i < pull_up_lengths.length; i++) {
            var length = pull_up_lengths[i];

            if (length < shortest_pull_up)
                shortest_pull_up = length;

            if (length > longest_pull_up)
                longest_pull_up = length;
        }

        // use the halfway to determine whether the period it is long or short
        var halfway = shortest_pull_up + (longest_pull_up - shortest_pull_up) / 2
        bits = []

        for (var i = 0; i < pull_up_lengths.length; i++) {
            var bit = false;
            if (pull_up_lengths[i] > halfway)
                bit = true;

            bits.push(bit);
        }

        return bits
    },

    __bits_to_bytes: function(bits) {
        var the_bytes = []
        var byte = 0

        for (var i = 0; i < bits.length; i++) {
            byte = byte << 1;
            if (bits[i])
                byte = byte | 1;
            else
                byte = byte | 0;

            if ((i + 1) % 8 == 0) {
                the_bytes.push(byte);
                byte = 0;
            }
        }

        return the_bytes;
    },

    __calculate_checksum: function(the_bytes) {
        return (the_bytes[0] + the_bytes[1] + the_bytes[2] + the_bytes[3]) & 255;
    }


}
