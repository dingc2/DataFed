#include <iostream>
#include <unistd.h>

#define DEF_DYNALOG
#include "DynaLog.hpp"
#include "TraceException.hpp"

#include "FacilityServer.hpp"

using namespace std;
using namespace SDMS;

int main( int a_argc, char ** a_argv )
{
    try
    {
        DL_SET_ENABLED(true);
        DL_SET_LEVEL(DynaLog::DL_TRACE_LEV);
        DL_SET_CERR_ENABLED(true);
        DL_SET_SYSDL_ENABLED(false);

        int         port = 5800;
        int         timeout = 5;
        uint32_t    num_threads = 0;
        const char * verify_path = "/home/d3s/.sdms-server/";
        int opt;

        while (( opt = getopt( a_argc, a_argv, "?p:n:t:v:" )) != -1 )
        {
            switch( opt )
            {
            case '?':
                cout << "options:" << endl;
                cout << "?      - show help" << endl;
                cout << "p port - set server port" << endl;
                cout << "n num  - set num threads" << endl;
                cout << "t sec  - timeout (sec)" << endl;
                cout << "v path - set client verify path" << endl;
                return 0;
            case 'p':
                port = atoi( optarg );
                break;
            case 'n':
                num_threads = (uint32_t)atoi( optarg );
                break;
            case 't':
                timeout = atoi( optarg );
                break;
            case 'v':
                verify_path = optarg;
                break;
            }
        }

        Facility::Server server( port, verify_path, timeout, num_threads );

        cout << "start\n";
        server.run( false );

/*
        server.run( true );
        cout << "wait\n";

        sleep( 30 );
        cout << "stop\n";
        
        server.stop( true );
*/
        cout << "exit\n";
    }
    catch( TraceException &e )
    {
        cout << e.toString() << "\n";
    }
    catch( exception &e )
    {
        cout << "Exception: " << e.what() << "\n";
    }

    return 0;
}

